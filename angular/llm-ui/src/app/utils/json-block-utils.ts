// --- From packages/json/src/types.ts ---
export type JsonAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

// --- From packages/json/src/options.ts ---
export interface JsonBlockOptionsComplete {
  type: string;
  startChar: string;
  endChar: string;
  defaultVisible: boolean;
  visibleKeyPaths: string[];
  invisibleKeyPaths: string[];
  typeKey: string;
}

export const defaultJsonOptions: Omit<JsonBlockOptionsComplete, "type"> = {
  startChar: "【",
  endChar: "】",
  defaultVisible: false,
  visibleKeyPaths: [],
  invisibleKeyPaths: [],
  typeKey: "type",
};

export type JsonBlockOptions = Partial<Omit<JsonBlockOptionsComplete, "type">> &
  Pick<JsonBlockOptionsComplete, "type">;

export function getJsonBlockOptions(
  userOptions: JsonBlockOptions,
): JsonBlockOptionsComplete {
  if (!userOptions.type) {
    throw new Error("type option is required for JSON blocks");
  }
  return { ...defaultJsonOptions, ...userOptions };
}

// --- From packages/json/src/jsonPathSet.ts ---
export function setJsonPath(obj: JsonAny, path: string, value: string): void {
  const keys = path.replace(/^\$\.?/, "").split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

// --- From packages/json/src/jsonPathTraverse.ts ---
// Simplified for direct inclusion, original uses import { escape } from "jsonpath-plus";
// For now, basic path matching. If true JSONPath features are needed, jsonpath-plus would be a dep.
function pathMatches(pattern: string, path: string): boolean {
    // Basic wildcard support at the end of a pattern
    if (pattern.endsWith('.*')) {
        const basePattern = pattern.slice(0, -2);
        return path.startsWith(basePattern);
    }
    return pattern === path;
}

export function isAllowed(allowedPaths: string[]): (path: string) => boolean {
    return (path: string): boolean => {
        return allowedPaths.some(allowedPath => pathMatches(allowedPath, path));
    };
}

export function isIgnored(ignoredPaths: string[]): (path: string) => boolean {
    return (path: string): boolean => {
        // Corrected logic: should return true if any ignoredPath matches (path IS ignored)
        // The original was `!ignoredPaths.some(...)` which means "path is NOT ignored by ANY" -> "path IS allowed by ALL" (if all paths were ignore paths)
        // It should be: "path IS ignored if ANY ignoredPath matches it"
        return ignoredPaths.some(ignoredPath => pathMatches(ignoredPath, path));
    };
}

export function traverseLeafNodes(
    obj: JsonAny,
    shouldTraverse: (path: string) => boolean,
    onLeafNode: (value: unknown, path: string) => void,
    currentPath = "$",
  ): void {
    if (!shouldTraverse(currentPath) && currentPath !== "$") {
      return;
    }
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      const path = `${currentPath}.${key}`;
      if (!shouldTraverse(path)) {
        return;
      }
      if (typeof value === "object" && value !== null) {
        traverseLeafNodes(value, shouldTraverse, onLeafNode, path);
      } else {
        onLeafNode(value, path);
      }
    });
  }

// Import LLMOutputMatcher and LookBackFunction from the main model types
import { LLMOutputMatcher, LookBackFunction, MaybeLLMOutputMatch } from '../models/llm-output-types';
import { regexMatcherGlobal, removeStartEndChars } from './shared-utils'; // Import from shared utils

// --- From packages/json/src/parseJson5.ts ---
import { jsonrepair } from 'jsonrepair';

export function parseJson5(json5: string): JsonAny | undefined {
  try {
    // First, try to repair common JSON errors (comments, trailing commas, etc.)
    const repairedJson = jsonrepair(json5);
    // Then parse the repaired string
    return JSON.parse(repairedJson);
  } catch (e) {
    // console.error("Failed to parse JSON5:", e, "Original string:", json5);
    return undefined;
  }
}

// --- From packages/json/src/matchers.ts ---
function findJsonBlock(
  regex: RegExp,
  options: JsonBlockOptionsComplete,
): LLMOutputMatcher {
  const { type } = options;
  const matcher = regexMatcherGlobal(regex); // Uses shared util

  return (llmOutput: string): MaybeLLMOutputMatch => {
    const matches = matcher(llmOutput);
    if (!matches || matches.length === 0) {
      return undefined;
    }
    // Find the first match that successfully parses and matches the type
    for (const matchAttempt of matches) {
      if (!matchAttempt) continue; 
      const blockContent = removeStartEndChars(matchAttempt.outputRaw, options); // Uses shared util
      const parsedBlock = parseJson5(blockContent);

      if (parsedBlock && parsedBlock[options.typeKey] === type) {
        return {
            startIndex: matchAttempt.startIndex,
            endIndex: matchAttempt.endIndex,
            outputRaw: matchAttempt.outputRaw
        };
      }
    }
    return undefined;
  };
}

export function getJsonMatchers(userOptions: JsonBlockOptions): { findCompleteMatch: LLMOutputMatcher, findPartialMatch: LLMOutputMatcher } {
  const options = getJsonBlockOptions(userOptions); 
  const { startChar, endChar } = options;

  const completeRegex = new RegExp(`${startChar.replace(/[.*+?^${{}}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)${endChar.replace(/[.*+?^${{}}()|[\]\\]/g, '\\$&')}`, "g");
  const partialRegex = new RegExp(`${startChar.replace(/[.*+?^${{}}()|[\]\\]/g, '\\$&')}([\\s\\S]*)`, "g");

  return {
    findCompleteMatch: findJsonBlock(completeRegex, options),
    findPartialMatch: findJsonBlock(partialRegex, options),
  };
}


// --- From packages/json/src/lookback.ts ---
export function getJsonLookBack(userOptions: JsonBlockOptions): LookBackFunction {
  const options = getJsonBlockOptions(userOptions);
  const { type, typeKey, defaultVisible, visibleKeyPaths, invisibleKeyPaths } = options;

  return ({ output: rawMatchedOutput, isComplete, visibleTextLengthTarget }) => {
    const contentWithoutDelimiters = removeStartEndChars(rawMatchedOutput, options); // Uses shared util
    const object = parseJson5(contentWithoutDelimiters);

    if (!object || object[typeKey] !== type) {
      return { output: "", visibleText: "" };
    }

    let remainingChars = visibleTextLengthTarget;
    let currentVisibleText = "";
    const objectForProcessing = JSON.parse(JSON.stringify(object));

    const finalInvisibleKeyPaths = defaultVisible ? [`$.${typeKey}`, ...invisibleKeyPaths] : invisibleKeyPaths;
    const finalVisibleKeyPaths = defaultVisible ? visibleKeyPaths : (visibleKeyPaths.length > 0 ? visibleKeyPaths : []);

    const effectiveShouldTraverse = defaultVisible
        ? (path: string) => !isIgnored(finalInvisibleKeyPaths)(path) 
        : isAllowed(finalVisibleKeyPaths);

    traverseLeafNodes(objectForProcessing, effectiveShouldTraverse, (value, path) => {
      if (typeof value === 'string') {
        const valueString = `${value}`;
        const chars = Math.min(remainingChars, valueString.length);
        const valueVisible = valueString.slice(0, chars);
        currentVisibleText += valueVisible;
        setJsonPath(objectForProcessing, path, valueVisible); 
        remainingChars -= chars;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        const valueString = `${value}`;
        const chars = Math.min(remainingChars, valueString.length);
        const valueVisible = valueString.slice(0, chars);
        currentVisibleText += valueVisible;
        setJsonPath(objectForProcessing, path, valueVisible);
        remainingChars -= chars;
      }
    });
    
    const isAnythingEffectivelyVisible = defaultVisible || finalVisibleKeyPaths.length > 0;

    return {
      output: JSON.stringify(objectForProcessing, null, 2), 
      visibleText: isAnythingEffectivelyVisible
        ? currentVisibleText
        : (isComplete && visibleTextLengthTarget > 0 ? " " : ""), 
    };
  };
}