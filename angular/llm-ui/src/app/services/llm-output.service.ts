import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  BlockMatch,
  LLMOutputBlock,
  LLMOutputFallbackBlock,
  ThrottleFunction,
  LLMOutputMatch,
  BlockMatchNoLookback,
  // Ensure all necessary types from llm-output-types are imported
} from '../models/llm-output-types';
import { MarkdownParserService } from './markdown-parser.service';

// Placeholder for throttleBasic, assuming it's defined or imported elsewhere
// For now, let's keep the simple definition
const throttleBasic = (): ThrottleFunction => (params) => ({ visibleTextIncrement: Math.max(0, params.visibleTextAll.length - params.visibleText.length) });

export interface LlmOutputServiceState {
  blockMatches: BlockMatch[];
  isFinished: boolean;
  visibleText: string;
  finishCount: number;
}

const initialState: LlmOutputServiceState = {
  blockMatches: [],
  isFinished: false,
  visibleText: '',
  finishCount: 0,
};

@Injectable({
  providedIn: 'root',
})
export class LlmOutputService {
  private stateSubject = new BehaviorSubject<LlmOutputServiceState>(initialState);
  public state$: Observable<LlmOutputServiceState> = this.stateSubject.asObservable();

  private llmOutput = '';
  private isStreamFinished = false;
  private blocks: LLMOutputBlock[] = [];
  private fallbackBlock!: LLMOutputFallbackBlock;
  private throttle: ThrottleFunction = throttleBasic();
  private onFinishCallback: () => void = () => {};

  private startTime = 0;
  private lastRenderTime = 0;
  private frameRef?: number;
  private frameCount = 0;
  private finishTime?: DOMHighResTimeStamp;
  private previousFrameTime?: DOMHighResTimeStamp;
  private visibleTextAllLengths: number[] = [];
  private outputLengths: number[] = [];
  private visibleTextIncrements: number[] = [];
  private visibleTextLengthTarget = 0;

  constructor(
    private markdownParser: MarkdownParserService,
    private ngZone: NgZone
  ) {
    this.fallbackBlock = {
        component: null as any, // Placeholder, will be set by LlmOutputDisplayComponent
        lookBack: (params) => ({ output: params.output, visibleText: params.output }),
    };
  }

  public initialize(
    blocks: LLMOutputBlock[],
    fallbackBlock: LLMOutputFallbackBlock,
    throttle?: ThrottleFunction,
    onFinish?: () => void
  ): void {
    this.blocks = blocks;
    this.fallbackBlock = fallbackBlock;
    if (throttle) {
      this.throttle = throttle;
    }
    if (onFinish) {
      this.onFinishCallback = onFinish;
    }
    // Reset state when re-initializing with new blocks or fallback
    this.reset();
    // If llmOutput already has value, start processing
    if (this.llmOutput && this.llmOutput.length > 0) {
        this.ngZone.runOutsideAngular(() => {
            this.frameRef = requestAnimationFrame((time) => this.renderLoop(time));
        });
    }
  }

  public setLlmOutput(llmOutput: string, isStreamFinished: boolean): void {
    const oldLlmOutput = this.llmOutput;
    const oldIsStreamFinished = this.isStreamFinished;

    this.llmOutput = llmOutput;
    this.isStreamFinished = isStreamFinished;

    if (!this.finishTime && isStreamFinished) {
        this.finishTime = performance.now();
    }
    
    // Only start render loop if output changed or stream finished state changed
    // and there's output to process or it's the first time setting output.
    if ((oldLlmOutput !== llmOutput || oldIsStreamFinished !== isStreamFinished) && !this.frameRef && this.llmOutput && this.llmOutput.length > 0) {
      this.ngZone.runOutsideAngular(() => {
        this.frameRef = requestAnimationFrame((time) => this.renderLoop(time));
      });
    } else if (this.visibleTextIncrements.length > 0 && this.llmOutput.length === 0) {
      this.reset();
    }
  }

  public restart(): void {
    this.reset();
    setTimeout(() => {
      if (this.llmOutput && this.llmOutput.length > 0) {
        this.ngZone.runOutsideAngular(() => {
            this.frameRef = requestAnimationFrame((time) => this.renderLoop(time));
        });
      }
    }, 10);
  }

  private reset(): void {
    // Preserve llmOutput and isStreamFinished if they were already set.
    // Resetting these would require the consumer to call setLlmOutput again.
    // const currentLlmOutput = this.llmOutput;
    // const currentIsStreamFinished = this.isStreamFinished;

    this.stateSubject.next(initialState);
    this.startTime = performance.now();
    this.finishTime = undefined;
    this.previousFrameTime = undefined;
    this.visibleTextAllLengths = [];
    this.outputLengths = [];
    this.visibleTextIncrements = [];
    this.visibleTextLengthTarget = 0;
    this.frameCount = 0;
    if (this.frameRef) {
      cancelAnimationFrame(this.frameRef);
      this.frameRef = undefined;
    }
    // Restore after reset if needed, or expect setLlmOutput to be called.
    // this.llmOutput = currentLlmOutput;
    // this.isStreamFinished = currentIsStreamFinished;
  }

  private renderLoop(frameTime: DOMHighResTimeStamp): void {
    if (!this.llmOutput && !this.isStreamFinished) { // If output is empty and stream not finished, nothing to do.
        this.frameRef = undefined;
        return;
    }

    const allMatches = this.matchBlocksInternal(this.llmOutput, this.blocks, this.fallbackBlock, this.isStreamFinished, Number.MAX_SAFE_INTEGER);
    const currentBlockMatches = this.stateSubject.value.blockMatches;
    const visibleText = this.matchesToVisibleText(currentBlockMatches);

    const visibleTextAll = this.matchesToVisibleText(allMatches);
    const outputAll = this.matchesToOutput(allMatches);

    if (!this.isStreamFinished) {
      this.visibleTextAllLengths.push(visibleTextAll.length);
      this.outputLengths.push(outputAll.length);
    }

    const isDisplayFinished = visibleText === visibleTextAll && this.isStreamFinished;

    if (isDisplayFinished) {
      this.frameRef = undefined;
      // Ensure final state uses allMatches
      this.stateSubject.next({
        ...this.stateSubject.value,
        blockMatches: allMatches, 
        isFinished: true,
        finishCount: this.stateSubject.value.finishCount + 1,
        visibleText: visibleTextAll,
      });
      this.onFinishCallback();
      return;
    }

    const visibleTextLengthsAll = this.isStreamFinished
      ? [...this.visibleTextAllLengths, visibleTextAll.length]
      : this.visibleTextAllLengths;

    const outputLengthsAll = this.isStreamFinished
      ? [...this.outputLengths, outputAll.length]
      : this.outputLengths;

    const { visibleTextIncrement } = this.throttle({
      outputRaw: this.llmOutput,
      outputRendered: this.matchesToOutput(currentBlockMatches),
      outputAll: outputAll,
      visibleText,
      visibleTextAll,
      startStreamTime: this.startTime,
      isStreamFinished: this.isStreamFinished,
      frameCount: this.frameCount,
      frameTime,
      frameTimePrevious: this.previousFrameTime,
      finishStreamTime: this.finishTime,
      visibleTextLengthsAll: visibleTextLengthsAll,
      outputLengths: outputLengthsAll,
      visibleTextIncrements: this.visibleTextIncrements,
      visibleTextLengthTarget: this.visibleTextLengthTarget,
    });

    if (visibleTextIncrement < 0) {
      console.error("Throttle returned negative visibleTextIncrement");
      this.frameRef = undefined;
      return;
    }

    this.visibleTextIncrements.push(visibleTextIncrement);
    this.visibleTextLengthTarget = this.visibleTextLengthTarget + visibleTextIncrement;

    let nextBlockMatches = currentBlockMatches;
    let nextVisibleText = visibleText;

    if (this.visibleTextLengthTarget > visibleText.length || (this.isStreamFinished && visibleText !== visibleTextAll)) {
      const matchesWithTargetLength = this.matchBlocksInternal(
        this.llmOutput,
        this.blocks,
        this.fallbackBlock,
        this.isStreamFinished,
        this.visibleTextLengthTarget
      );
      nextBlockMatches = matchesWithTargetLength;
      nextVisibleText = this.matchesToVisibleText(matchesWithTargetLength);
      this.lastRenderTime = performance.now();
    }

    this.stateSubject.next({
        ...this.stateSubject.value,
        blockMatches: nextBlockMatches,
        isFinished: false,
        visibleText: nextVisibleText,
    });

    this.previousFrameTime = frameTime;
    this.frameCount++;
    this.frameRef = requestAnimationFrame((time) => this.renderLoop(time));
  }

  private matchesToVisibleText(matches: BlockMatch[]): string {
    return matches.map((match) => match.visibleText).join('');
  }

  private matchesToOutput(matches: BlockMatch[]): string {
    return matches.map((match) => match.output).join('');
  }

  // --- Start of translated block matching logic ---
  private completeMatchesForBlock({ llmOutput, block, priority }: {
    llmOutput: string;
    block: LLMOutputBlock;
    priority: number;
  }): BlockMatchNoLookback[] {
    const matches: BlockMatchNoLookback[] = [];
    let index = 0;
    while (index < llmOutput.length) {
      const nextMatch = block.findCompleteMatch(llmOutput.slice(index));
      if (nextMatch) {
        matches.push({
          block,
          match: {
            outputRaw: nextMatch.outputRaw,
            startIndex: index + nextMatch.startIndex,
            endIndex: index + nextMatch.endIndex,
          },
          llmOutput,
          isComplete: true,
          priority,
        });
        index += nextMatch.endIndex;
      } else {
        return matches;
      }
    }
    return matches;
  }

  private highestPriorityNonOverlappingMatches(matches: BlockMatchNoLookback[]): BlockMatchNoLookback[] {
    return matches.filter((match) => {
      const higherPriorityMatches = matches.filter(
        (m) => m.priority < match.priority,
      );
      return !higherPriorityMatches.some((m) =>
        this.isOverlapping(m.match, match.match),
      );
    });
  }

  private byMatchStartIndex(match1: BlockMatchNoLookback, match2: BlockMatchNoLookback): number {
    return match1.match.startIndex - match2.match.startIndex;
  }

  private isOverlapping(match1: LLMOutputMatch, match2: LLMOutputMatch): boolean {
    return (
      (match1.startIndex >= match2.startIndex &&
        match1.startIndex < match2.endIndex) ||
      (match1.endIndex > match2.startIndex &&
        match1.endIndex <= match2.endIndex) ||
      (match2.startIndex >= match1.startIndex &&
        match2.startIndex < match1.endIndex) ||
      (match2.endIndex > match1.startIndex && match2.endIndex <= match1.endIndex)
    );
  }

  private findPartialMatch({ llmOutput, blocks, currentIndex }: {
    llmOutput: string;
    currentIndex: number;
    blocks: LLMOutputBlock[];
  }): BlockMatchNoLookback | undefined {
    for (const [priority, block] of Array.from(blocks.entries())) {
      const outputRaw = llmOutput.slice(currentIndex);
      const partialMatch = block.findPartialMatch(outputRaw);
      if (partialMatch) {
        return {
          block: block,
          match: {
            outputRaw: partialMatch.outputRaw,
            startIndex: partialMatch.startIndex + currentIndex,
            endIndex: partialMatch.endIndex + currentIndex,
          },
          llmOutput,
          isComplete: true, // This seems to be always true for partial matches in original
          priority,
        };
      }
    }
    return undefined;
  }

  private fallbacksInGaps({ blockMatches, llmOutput, fallbackPriority, fallbackBlock }: {
    blockMatches: BlockMatchNoLookback[];
    llmOutput: string;
    fallbackPriority: number;
    fallbackBlock: LLMOutputFallbackBlock;
  }): BlockMatchNoLookback[] {
    const fallbacks: BlockMatchNoLookback[] = [];
    let currentFallbackStartIndex = 0;

    blockMatches.forEach(match => {
        if (currentFallbackStartIndex < match.match.startIndex) {
            const outputRaw = llmOutput.slice(currentFallbackStartIndex, match.match.startIndex);
            fallbacks.push({
                block: fallbackBlock,
                match: {
                    startIndex: currentFallbackStartIndex,
                    endIndex: match.match.startIndex,
                    outputRaw,
                },
                priority: fallbackPriority,
                llmOutput,
                isComplete: true, // Gaps are by definition "complete" as fallback text
            });
        }
        currentFallbackStartIndex = match.match.endIndex;
    });
    
    // Add last fallback that reaches to end of output
    if (currentFallbackStartIndex < llmOutput.length) {
        const outputRaw = llmOutput.slice(currentFallbackStartIndex, llmOutput.length);
        fallbacks.push({
            block: fallbackBlock,
            match: {
                startIndex: currentFallbackStartIndex,
                endIndex: llmOutput.length,
                outputRaw,
            },
            priority: fallbackPriority,
            llmOutput,
            isComplete: false, // The very last fallback might not be "complete" if stream isn't finished
        });
    }
    return fallbacks;
  }

  private matchesWithLookback({ llmOutputRaw, matches, visibleTextLengthTarget, isStreamFinished }: {
    llmOutputRaw: string;
    matches: BlockMatchNoLookback[];
    visibleTextLengthTarget: number;
    isStreamFinished: boolean;
  }): BlockMatch[] {
    return matches.reduce((acc, match, index) => {
      const visibleTextSoFar = acc
        .map((m) => m.visibleText.length)
        .reduce((a, b) => a + b, 0);
      const localVisibleTextLengthTarget = Math.max(
        visibleTextLengthTarget - visibleTextSoFar,
        0,
      );

      const isLastMatch = index === matches.length - 1;
      // A match is complete if it's not the last one, or if it is the last one AND the stream is finished.
      // Or, if its own block type considers it complete (e.g. a fully formed JSON block).
      // The original `isComplete` on `BlockMatchNoLookback` seems to be mostly true.
      // The `lookBack` function gets `isComplete` based on whether it's the last segment of text being processed.
      const lookBackIsComplete = !isLastMatch || isStreamFinished;

      const { output, visibleText } = match.block.lookBack({
        isComplete: lookBackIsComplete,
        visibleTextLengthTarget: localVisibleTextLengthTarget,
        isStreamFinished: isStreamFinished,
        output: match.match.outputRaw,
      });

      if (visibleText.length > localVisibleTextLengthTarget) {
        console.warn(
          `Visible text length exceeded target for: ${visibleText} has length ${visibleText.length} target: ${localVisibleTextLengthTarget}. Raw output: ${llmOutputRaw}`,
        );
      }
      const matchWithLookback: BlockMatch = {
        // Spread from match.match (LLMOutputMatch)
        startIndex: match.match.startIndex,
        endIndex: match.match.endIndex,
        outputRaw: match.match.outputRaw,
        // Spread from MatchBase
        block: match.block,
        priority: match.priority,
        llmOutput: match.llmOutput, // This is the full llmOutput string
        isComplete: lookBackIsComplete, // This now reflects the lookBack's perspective of completeness
        // Properties from LLMOutputMatchWithLookBack
        output,
        visibleText,
        isVisible: visibleText.length > 0,
      }};

      return [...acc, matchWithLookback];
    }, [] as BlockMatch[]);
  }

  // This is the main internal function, equivalent to `matchBlocks` from helper.ts
  private matchBlocksInternal(
    llmOutput: string,
    blocks: LLMOutputBlock[],
    fallbackBlock: LLMOutputFallbackBlock,
    isStreamFinished: boolean,
    visibleTextLengthTarget: number = Number.MAX_SAFE_INTEGER,
  ): BlockMatch[] {
    if (!llmOutput) {
        return [];
    }
    const allCompleteMatches = blocks.flatMap((block, priority) =>
      this.completeMatchesForBlock({
        llmOutput,
        block,
        priority,
      }),
    );

    let currentMatches = this.highestPriorityNonOverlappingMatches(allCompleteMatches);
    currentMatches.sort(this.byMatchStartIndex);
    
    const lastMatchEndIndex =
      currentMatches.length > 0 ? currentMatches[currentMatches.length - 1].match.endIndex : 0;

    // Only find partial match if stream is not finished and there's remaining text
    if (!isStreamFinished && lastMatchEndIndex < llmOutput.length) {
        const partialMatch = this.findPartialMatch({
            llmOutput,
            currentIndex: lastMatchEndIndex,
            blocks,
        });
        if (partialMatch) {
            // Add partial match only if it doesn't overlap with existing higher priority matches
            // This check might be redundant if findPartialMatch itself respects priorities or if fallbacks handle overlaps
            const nonOverlappingWithPartial = !currentMatches.some(m => this.isOverlapping(m.match, partialMatch.match));
            if (nonOverlappingWithPartial) {
                 currentMatches.push(partialMatch);
                 currentMatches.sort(this.byMatchStartIndex); // Re-sort after adding partial
            }
        }
    }

    const fallBacks = this.fallbacksInGaps({
      blockMatches: currentMatches, // Pass current matches including partial if added
      llmOutput,
      fallbackPriority: blocks.length, // Fallback has the lowest priority
      fallbackBlock,
    });

    // Add fallbacks and re-sort
    currentMatches.push(...fallBacks);
    currentMatches.sort(this.byMatchStartIndex);

    // Filter out empty fallback matches that might have been created if gaps were zero-length
    // or if a partial match filled a space that a fallback also tried to fill.
    // A truly robust solution might need to refine fallbacksInGaps or how partials are merged.
    currentMatches = currentMatches.filter(m => m.match.startIndex < m.match.endIndex);


    return this.matchesWithLookback({
      llmOutputRaw: llmOutput,
      matches: currentMatches,
      isStreamFinished,
      visibleTextLengthTarget,
    });
  }
  // --- End of translated block matching logic ---

  ngOnDestroy(): void {
    if (this.frameRef) {
      cancelAnimationFrame(this.frameRef);
    }
    this.stateSubject.complete();
  }
}
