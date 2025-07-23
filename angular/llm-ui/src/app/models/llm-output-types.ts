import { Type } from '@angular/core'; // Import Type for Angular components

export interface LLMOutputMatch {
  startIndex: number;
  endIndex: number;
  outputRaw: string;
}

export interface MatchBase {
  block: LLMOutputFallbackBlock;
  priority: number;
  llmOutput: string;
  isComplete: boolean;
}

export interface BlockMatch extends MatchBase, LLMOutputMatchWithLookBack {}

export interface BlockMatchNoLookback extends MatchBase {
  match: LLMOutputMatch;
}

export interface LLMOutputMatchWithLookBack extends LLMOutputMatch {
  output: string;
  visibleText: string;
  isVisible: boolean;
}

export type MaybeLLMOutputMatch = LLMOutputMatch | undefined;

// Replace React.FC with a more Angular-friendly type.
// Using 'any' for now, or 'Type<any>' if we want to enforce it's a component type.
// A more specific interface could be: export interface LLMOutputComponentInterface { blockMatch: BlockMatch; [key: string]: any; }
// Then use: export type LLMOutputComponent<Props = unknown> = Type<LLMOutputComponentInterface & Props>;
export type LLMOutputComponent<Props = unknown> = Type<any>;


export type LLMOutputMatcher = (llmOutput: string) => MaybeLLMOutputMatch;

export interface LookBack {
  output: string;
  visibleText: string;
}

export interface LookBackFunctionParams {
  output: string;
  isComplete: boolean;
  visibleTextLengthTarget: number;
  isStreamFinished: boolean;
}

export type LookBackFunction = (params: LookBackFunctionParams) => LookBack;

export interface LLMOutputFallbackBlock {
  component: LLMOutputComponent; // Adjusted for Angular
  lookBack: LookBackFunction;
}

export interface LLMOutputBlock extends LLMOutputFallbackBlock {
  findPartialMatch: LLMOutputMatcher;
  findCompleteMatch: LLMOutputMatcher;
}

export interface ThrottleParams {
  outputRaw: string;
  outputRendered: string;
  outputAll: string;
  visibleText: string;
  visibleTextAll: string;
  isStreamFinished: boolean;
  frameCount: number;
  frameTime: DOMHighResTimeStamp;
  frameTimePrevious: DOMHighResTimeStamp | undefined;
  startStreamTime: DOMHighResTimeStamp;
  finishStreamTime: DOMHighResTimeStamp | undefined;
  visibleTextLengthsAll: number[];
  outputLengths: number[];
  visibleTextIncrements: number[];
  visibleTextLengthTarget: number;
}

export interface ThrottleResponse {
  visibleTextIncrement: number;
}

export type ThrottleFunction = (params: ThrottleParams) => ThrottleResponse;
