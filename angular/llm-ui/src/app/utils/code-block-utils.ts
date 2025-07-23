// At the top of code-block-utils.ts
import { LLMOutputMatcher, LookBackFunction, MaybeLLMOutputMatch } from '../models/llm-output-types';
import { regexMatcher } from './shared-utils'; // regexMatcherGlobal is not typically used for code blocks

// --- From packages/code/src/options.ts ---
export interface CodeBlockOptions {
  startEndChars: string[];
}

export const defaultCodeBlockOptions: CodeBlockOptions = {
  startEndChars: ["`"], // Typically used for ```
};

export function getCodeBlockOptions( // Renamed for clarity
  userOptions?: Partial<CodeBlockOptions>
): CodeBlockOptions {
  return { ...defaultCodeBlockOptions, ...userOptions };
}

// --- Refined getStartEndGroupRegex and Parsing Logic ---
// This function aims to replicate the group needed for regex matching fences
function getFenceRegexGroup(chars: string[], exactLength?: number): string {
  if (exactLength) {
    return `(?:${chars.map(c => c.repeat(exactLength)).join('|')})`;
  }
  // Matches 1 or 2 of any char in the list (for partial end fence) OR exactly 3 of any char.
  // Useful for partial matching where user might have typed `` or ` instead of ```
  return `(?:${chars.map(c => `${c}{1,2}(?!${c})|${c}{3,}`).join('|')})`;
}


export interface CodeBlockData {
  language: string | undefined;
  metaString: string | undefined;
  code: string | undefined;
}

// Updated parseCodeBlock, now takes the raw matched block content
export function parseCodeBlock(
  rawMatchedBlock: string, // This is the full matched string, e.g., ```python \n code \n ```
  userOptions?: Partial<CodeBlockOptions>,
  isCompleteMatch: boolean = true, // Flag to differentiate parsing if necessary
): CodeBlockData {
  const options = getCodeBlockOptions(userOptions);
  const fence = options.startEndChars[0].repeat(3); // Assuming ``` or similar based on first char
  
  let language: string | undefined;
  let metaString: string | undefined;
  let codeContent: string | undefined;

  if (rawMatchedBlock.startsWith(fence)) {
    const firstNewlineIndex = rawMatchedBlock.indexOf('\n');
    if (firstNewlineIndex > -1) { // Language/meta line exists
      const firstLine = rawMatchedBlock.substring(fence.length, firstNewlineIndex).trim();
      if (firstLine) {
        const langMatch = firstLine.match(/^(\S+)/);
        if (langMatch) {
          language = langMatch[1];
          metaString = firstLine.substring(language.length).trim() || undefined;
        } else {
          language = firstLine; 
        }
      }
      // Code content extraction
      // Check if the block ends with a newline followed by the closing fence
      if (isCompleteMatch && rawMatchedBlock.endsWith(`\n${fence}`)) {
        codeContent = rawMatchedBlock.substring(firstNewlineIndex + 1, rawMatchedBlock.length - (fence.length + 1));
      } else {
        // Partial match, or block doesn't end with newline then fence (e.g. ```python\ncode```)
        // Or, it's a complete match but the closing fence isn't preceded by a newline (less common markdown)
        let potentialCode = rawMatchedBlock.substring(firstNewlineIndex + 1);
        if (isCompleteMatch && potentialCode.endsWith(fence) && !rawMatchedBlock.endsWith(`\n${fence}`)) {
            // Handles ```python\ncode``` case for complete matches
            potentialCode = potentialCode.slice(0, -fence.length);
        }
        codeContent = potentialCode;
      }
    } else { // No newline after opening fence, e.g., ```python or ```
      const firstLineContent = rawMatchedBlock.substring(fence.length).trim();
       if (firstLineContent) {
        const langMatch = firstLineContent.match(/^(\S+)/);
        if (langMatch) {
          language = langMatch[1];
          metaString = firstLineContent.substring(language.length).trim() || undefined;
        } else {
          language = firstLineContent;
        }
      }
      codeContent = ""; // No code content yet if only ```lang line is present
    }
  } else {
    // Does not start with fence - this should ideally not happen if matchers pass correct rawMatchedBlock
    codeContent = rawMatchedBlock; // Treat as raw code as a fallback
  }
  return { language, metaString, code: codeContent };
}

// --- Matcher Logic (from packages/code/src/matchers.ts) ---
export function getCodeBlockMatchers(userOptions?: Partial<CodeBlockOptions>): { findCompleteMatch: LLMOutputMatcher, findPartialMatch: LLMOutputMatcher } {
  const options = getCodeBlockOptions(userOptions);
  // Assuming startEndChars = ['`'] and we're looking for triple fences ```
  const fence = options.startEndChars[0].repeat(3);
  const escapedFence = fence.replace(/[.*+?^${{}}()|[\]\\]/g, '\\$&');

  // Regex for a complete code block: ```lang\ncode\n```
  // It captures: 1: lang+meta (optional), 2: code
  // The DOTALL flag (s) allows . to match newline characters for the code content.
  // Making language part non-greedy and code part greedy.
  // Adding ^ and $ anchors to ensure the whole string is a code block for this matcher.
  const completeRegex = new RegExp(`^${escapedFence}(\\S*\\s*[^\\n]*)\\n([\\s\\S]*?)\\n${escapedFence}$`, 's');
  
  // Regex for a partial code block: starts with ``` and captures everything after
  // Or, starts with ```, has language line, and then captures ongoing code
  // Captures: 1: lang+meta (optional), 2: code (potentially partial, optional)
  const partialRegex = new RegExp(`^${escapedFence}(\\S*\\s*[^\\n]*)(?:\\n([\\s\\S]*))?$`, 's');


  return {
    findCompleteMatch: regexMatcher(completeRegex), // from shared-utils
    findPartialMatch: regexMatcher(partialRegex),   // from shared-utils
  };
}

// --- Lookback Logic (from packages/code/src/lookBack.ts) ---
export function getCodeBlockLookBack(userOptions?: Partial<CodeBlockOptions>): LookBackFunction {
  const options = getCodeBlockOptions(userOptions);
  const fence = options.startEndChars[0].repeat(3);

  return ({ output: rawMatchedOutput, isComplete, visibleTextLengthTarget }) => {
    // rawMatchedOutput is the full matched string, e.g., ```python\ncode\n```
    const { code = "", language, metaString } = parseCodeBlock(rawMatchedOutput, options, isComplete);

    const visibleCode = code.slice(0, visibleTextLengthTarget);
    
    let reconstructedOutput = `${fence}${language || ""}${metaString ? ` ${metaString}` : ""}\n${visibleCode}`;
    
    // Determine if closing fence should be added
    if (isComplete) { // If the original match was deemed "complete" by its matcher
        reconstructedOutput += `\n${fence}`;
    } else {
        // For partial matches, only add closing fence if the *entire* code has been streamed and is visible now
        // AND the raw output itself ended like it was trying to close (e.g. user typed ```)
        // This is complex. A simpler rule for partial: if visibleCode === code, it means all code received for this
        // partial block is now visible. If rawMatchedOutput itself ended with a fence, it's complete *structurally*.
        // The `isComplete` flag from the matcher is more reliable for "structural completeness".
        // If not structurally complete, we don't add the closing fence unless all code is visible.
        // The original react lookback adds it if (isComplete || visibleCode < code), which seems counterintuitive for partials
        // Let's try: add if 'isComplete' or if the raw output itself already had the full structure.
        // A common scenario for partial is streaming, where `isComplete` is false until the final chunk.
        // If `rawMatchedOutput` already contains a closing fence (e.g. it was streamed that way), `parseCodeBlock` would have handled it.
        // The key is whether the *current segment* implies a desire to close.
        // The logic below tries to be conservative: only add fence if the matcher said it's complete,
        // or if we've shown all the code we have for this block AND the original raw output suggested a closing fence.
        // This part might need refinement based on observed streaming behavior.
        // A simpler approach: if `isComplete` is true, it has the closing fence.
        // If `isComplete` is false, it's a partial stream, so no closing fence unless `rawMatchedOutput` had it.
        // `parseCodeBlock` now handles `isCompleteMatch` for parsing.
        // The `reconstructedOutput` from `parseCodeBlock` via `code` would be just the content.
        // So, we only add `\n${fence}` if `isComplete` is true.
        // No, this is wrong. `rawMatchedOutput` is what the matcher gave. `parseCodeBlock` parses that.
        // `reconstructedOutput` is what *we* give back.
        // If `isComplete` is true, the block is structurally complete, so add fence.
        // If `isComplete` is false, it's a partial stream. Don't add fence.
        // (The original logic was: if (isComplete || visibleTextLength < (code?.length ?? 0)))
        // which means if it's complete OR if we truncated the code, add the fence.
        // This implies that if we show all code of a partial block, we don't add the fence.
        if (isComplete) {
            // Already added via parseCodeBlock's handling if it was a complete match ending in \n${fence}
            // The reconstructedOutput only has \n${visibleCode}. We need to add fence if complete.
            // Let's adjust: parseCodeBlock gives content. We build the output.
            // No, `parseCodeBlock` is given `rawMatchedOutput`.
            // `reconstructedOutput` should be based on `visibleCode`.
            // `reconstructedOutput = `${fence}${language || ""}${metaString ? ` ${metaString}` : ""}\n${visibleCode}`;`
            // if (isComplete) reconstructedOutput += `\n${fence}`;
            // This was the previous logic. The new parseCodeBlock gives code content only.
        }
    }
    // The `code` from parseCodeBlock is just the inner content.
    // We reconstruct the block for the `output` property.
    let finalOutput = `${fence}${language || ""}${metaString ? ` ${metaString}` : ""}\n${visibleCode}`;
    if (isComplete || (code.length === visibleCode.length && rawMatchedOutput.trim().endsWith(fence))) {
        // Add closing fence if:
        // 1. The matcher deemed it a complete block.
        // 2. OR, if all the code content of this block is visible AND the original raw match ended with a fence
        //    (this covers cases where a "partial" matcher might have matched a structurally complete block).
        finalOutput += `\n${fence}`;
    }


    return {
      output: finalOutput,
      visibleText: visibleCode,
    };
  };
}
