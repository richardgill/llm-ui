// --- From packages/csv/src/options.ts ---
export interface CsvBlockOptionsComplete {
  type: string;
  startChar: string;
  endChar: string;
  delimiter: string;
  allIndexesVisible: boolean;
  visibleIndexes: number[];
}

export const defaultCsvOptions: Omit<CsvBlockOptionsComplete, "type"> = {
  startChar: "⦅", // Using the actual default from original code "⦅"
  endChar: "⦆",   // Using "⦆"
  delimiter: ",",
  allIndexesVisible: true,
  visibleIndexes: [],
};

export type CsvBlockOptions = Partial<Omit<CsvBlockOptionsComplete, "type">> &
  Pick<CsvBlockOptionsComplete, "type">;

export function getCsvBlockOptions( // Renamed to avoid conflict if imported alongside getJsonBlockOptions
  userOptions: CsvBlockOptions,
): CsvBlockOptionsComplete {
  const result = { ...defaultCsvOptions, ...userOptions };
  const { type, allIndexesVisible, visibleIndexes } = result;
  if (!type) {
    throw new Error("type option is required for CSV blocks");
  }
  if (allIndexesVisible && visibleIndexes.length > 0) {
    // This validation was in original code, good to keep
    throw new Error(
      "visibleIndexes should be [] when allIndexesVisible is true",
    );
  }
  return result;
}

// --- From packages/csv/src/parseCsv.ts ---
export function parseCsv(
  csvString: string, // This is the content *inside* the delimiters, after type and first delimiter
  options: CsvBlockOptionsComplete, // Pass complete options here
): string[] {
  // The original parseCsv in packages/csv/src/parseCsv.ts takes CsvBlockOptions,
  // then calls getOptions(options) to get delimiter.
  // Here, we assume CsvBlockOptionsComplete is passed, which already has the delimiter.
  // The input `csvString` to this function in the original code is the raw content
  // *after* the type and the first delimiter have been processed by the regex in the matcher.
  // So, it's just the actual comma-separated values.
  if (csvString === undefined || csvString === null) return [];
  return csvString.split(options.delimiter).filter((item) => item !== "");
}

// Import LLMOutputMatcher and LookBackFunction from the main model types
import { LLMOutputMatcher, LookBackFunction, MaybeLLMOutputMatch } from '../models/llm-output-types';
// Import shared utilities
import { regexMatcher, removeStartEndChars } from './shared-utils'; // Assuming removeStartEndChars will be useful for lookback

// --- From packages/csv/src/matchers.ts ---
export function getCsvMatchers(userOptions: CsvBlockOptions): { findCompleteMatch: LLMOutputMatcher, findPartialMatch: LLMOutputMatcher } {
  const options = getCsvBlockOptions(userOptions); // Ensures options are complete
  const { type, startChar, endChar, delimiter } = options;

  // Escape special characters for regex
  const esc = (char: string) => char.replace(/[.*+?^${{}}()|[\]\\]/g, '\\$&');

  // Regex for complete match: e.g., ⦅my_type,data1,data2⦆
  // It captures the content *after* the type and first delimiter.
  const completeRegex = new RegExp(
    `${esc(startChar)}${esc(type)}${esc(delimiter)}([\\s\\S]*?)${esc(endChar)}`
  );
  
  // Regex for partial match: e.g., ⦅my_type,data1
  // It captures content after type and first delimiter, up to the end of the string.
  const partialRegex = new RegExp(
    `${esc(startChar)}${esc(type)}${esc(delimiter)}([\\s\\S]*)`
  );

  // The regexMatcher from shared-utils returns the full match as outputRaw.
  // The first captured group (if any) would be match[1], second match[2], etc.
  // For these regexes, match[0] is the full string, match[1] is the content (the CSV data itself).

  const createCsvMatcher = (regex: RegExp): LLMOutputMatcher => {
    const baseMatcher = regexMatcher(regex); // From shared-utils
    return (llmOutput: string): MaybeLLMOutputMatch => {
      const match = baseMatcher(llmOutput);
      if (match && match.outputRaw.length > 0) {
        // We return the full match here (outputRaw).
        // The content (group 1) will be extracted by parseCsv via lookBack.
        return {
            startIndex: match.startIndex,
            endIndex: match.endIndex,
            outputRaw: match.outputRaw,
            // We can optionally add the captured group if needed downstream,
            // but typically outputRaw is what's passed to lookBack.
            // groups: [matchResult[1]] // Content part
        };
      }
      return undefined;
    };
  };

  return {
    findCompleteMatch: createCsvMatcher(completeRegex),
    findPartialMatch: createCsvMatcher(partialRegex),
  };
}

// --- From packages/csv/src/lookback.ts ---
export function getCsvLookBack(userOptions: CsvBlockOptions): LookBackFunction {
  const completeOptions = getCsvBlockOptions(userOptions);
  const {
    allIndexesVisible,
    visibleIndexes: visibleIndexesOption,
    delimiter,
    startChar, // For reconstructing output if needed, or for removeStartEndChars
    endChar,   // For reconstructing output if needed
    type       // For reconstructing output
  } = completeOptions;

  // Escape special characters for regex, used in content extraction
  const esc = (char: string) => char.replace(/[.*+?^${{}}()|[\]\\]/g, '\\$&');

  return ({ output: rawMatchedOutput, isComplete, visibleTextLengthTarget }) => {
    // rawMatchedOutput is the full matched string, e.g., "⦅my_type,val1,val2,val3⦆"
    // We need to extract the content part for parseCsv.
    
    let csvContent = "";
    // Re-run a regex to get the content group.
    // This regex needs to handle both complete and partial match raw outputs.
    // For complete: ⦅my_type,data1,data2⦆ -> data1,data2
    // For partial: ⦅my_type,data1,da -> data1,da
    const contentRegex = new RegExp(`^${esc(startChar)}${esc(type)}${esc(delimiter)}([\\s\\S]*?)(?:${esc(endChar)})?$`);
    const contentMatch = contentRegex.exec(rawMatchedOutput);

    if (contentMatch && contentMatch[1] !== undefined) { 
        csvContent = contentMatch[1];
    } else {
        // This case should ideally not be reached if matchers are correct and pass valid rawMatchedOutput
        // console.warn("Could not extract CSV content from rawMatchedOutput:", rawMatchedOutput);
        // To be safe, try a simpler extraction if the regex fails (e.g. for very partial inputs)
        if (rawMatchedOutput.startsWith(`${startChar}${type}${delimiter}`)) {
            csvContent = rawMatchedOutput.substring(`${startChar}${type}${delimiter}`.length);
            if (isComplete && csvContent.endsWith(endChar)) {
                 csvContent = csvContent.slice(0, -endChar.length);
            }
        } else {
            return { output: rawMatchedOutput, visibleText: "" }; // Cannot process, return raw
        }
    }

    const parsedArray = parseCsv(csvContent, completeOptions);

    const effectiveVisibleIndexes = allIndexesVisible
      ? parsedArray.map((_, i) => i) // All indexes of the actual data part
      : visibleIndexesOption;

    let charsRemaining = visibleTextLengthTarget;
    const outputArrayForFinalJoin: string[] = [];
    const visibleArrayForTextJoin: string[] = [];

    parsedArray.forEach((item, index) => {
      if (effectiveVisibleIndexes.includes(index)) {
        const toKeep = Math.max(0, Math.min(charsRemaining, item.length));
        visibleArrayForTextJoin.push(item.slice(0, toKeep));
        outputArrayForFinalJoin.push(item.slice(0, toKeep)); // Truncated version for output too
        charsRemaining -= toKeep;
      } else {
        outputArrayForFinalJoin.push(item); // Full item if not visible (for final output string)
      }
    });
    
    // Reconstruct the full output string, including the type and delimiters
    const finalOutputString = `${startChar}${type}${delimiter}${outputArrayForFinalJoin.join(delimiter)}${isComplete ? endChar : ''}`;

    return {
      output: finalOutputString,
      visibleText:
        visibleArrayForTextJoin.length === 0
          ? (isComplete && visibleTextLengthTarget > 0 ? " " : "")
          // Join visible parts *without* delimiter for streaming effect, as per original package logic
          : visibleArrayForTextJoin.join(""), 
    };
  };
}
