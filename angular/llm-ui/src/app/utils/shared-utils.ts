import { MaybeLLMOutputMatch } from '../models/llm-output-types'; // Adjust path as necessary

/**
 * Creates a matcher function that finds all global occurrences of a regex in a text.
 * @param regex - The regular expression to match. Must have the global 'g' flag.
 * @returns An array of matches, or an empty array if no matches are found.
 */
export function regexMatcherGlobal(regex: RegExp): (text: string) => MaybeLLMOutputMatch[] {
  if (!regex.global) {
    // console.warn("Regex for regexMatcherGlobal should have the global 'g' flag.");
    // Potentially throw an error or add the flag programmatically, though adding it might change behavior if lastIndex is managed externally.
    // For now, we'll assume the caller provides a global regex.
  }
  return (text: string): MaybeLLMOutputMatch[] => {
    const matches: MaybeLLMOutputMatch[] = [];
    let matchResult: RegExpExecArray | null;
    // Ensure we don't have issues with lastIndex if regex is reused, though it should be fine if created fresh each call.
    const freshRegex = new RegExp(regex.source, regex.flags); // Create a fresh regex instance

    while ((matchResult = freshRegex.exec(text)) !== null) {
      matches.push({
        startIndex: matchResult.index,
        endIndex: matchResult.index + matchResult[0].length,
        outputRaw: matchResult[0],
        // If your regex uses named capture groups, you can access them via matchResult.groups
        // groups: matchResult.groups, 
      });
    }
    return matches;
  };
}

/**
 * Removes specified start and end characters/strings from a text if they exist.
 * @param text - The input string.
 * @param options - An object containing startChar and endChar to remove.
 * @returns The text with start/end characters removed.
 */
export function removeStartEndChars(
  text: string,
  options: { startChar: string; endChar: string }
): string {
  let result = text;
  if (options.startChar && result.startsWith(options.startChar)) {
    result = result.substring(options.startChar.length);
  }
  if (options.endChar && result.endsWith(options.endChar)) {
    result = result.substring(0, result.length - options.endChar.length);
  }
  return result;
}

/**
 * A simple regex matcher that returns the first match.
 * @param regex - The regular expression to match. Should NOT be global if only first match is desired.
 * @returns The first match found, or undefined.
 */
export function regexMatcher(regex: RegExp): (text: string) => MaybeLLMOutputMatch {
    if (regex.global) {
        // console.warn("Regex for regexMatcher should typically not have the global 'g' flag if only the first match is intended.");
        // Reset lastIndex if it's a global regex being reused, to ensure it searches from the beginning.
        regex.lastIndex = 0; 
    }
    return (text: string): MaybeLLMOutputMatch => {
        const matchResult = regex.exec(text);
        if (matchResult) {
            return {
                startIndex: matchResult.index,
                endIndex: matchResult.index + matchResult[0].length,
                outputRaw: matchResult[0],
                // groups: matchResult.groups,
            };
        }
        return undefined;
    };
}
