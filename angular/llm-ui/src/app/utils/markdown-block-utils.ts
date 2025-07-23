import { LookBackFunction } from '../models/llm-output-types';
// This is a simplified markdown lookback. The original @llm-ui/markdown had a more complex one.
// The LlmOutputService already uses MarkdownParserService for its main visible text processing.
// This lookback is for the fallback block, which receives already processed text.
// So, it might just pass through the text or apply minimal transformation.

export function getMarkdownLookBack(/* options?: any */): LookBackFunction {
  return ({ output, isComplete, visibleTextLengthTarget }) => {
    // `output` for fallback is typically the raw segment of text.
    // `visibleText` is what will be displayed incrementally.
    // The main LlmOutputService already does markdown processing to generate
    // the segments that become fallback blocks.
    return {
      output: output, // The segment of (likely markdown) text
      visibleText: output.slice(0, visibleTextLengthTarget),
    };
  };
}
