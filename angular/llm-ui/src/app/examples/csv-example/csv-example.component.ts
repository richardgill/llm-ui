import { Component, Type, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LlmOutputDisplayComponent } from '../../components/llm-output-display/llm-output-display.component';
import { LLMOutputBlock, LLMOutputFallbackBlock } from '../../models/llm-output-types';
import { CsvButtonsComponent } from '../../components/csv-buttons-block/csv-buttons-block.component';
import { FallbackBlockComponent } from '../../components/fallback-block/fallback-block.component';
import { getCsvMatchers, getCsvLookBack, CsvBlockOptions } from '../../utils/csv-block-utils';
import { getMarkdownLookBack } from '../../utils/markdown-block-utils';

@Component({
  selector: 'app-csv-example',
  standalone: true,
  imports: [CommonModule, LlmOutputDisplayComponent, CsvButtonsComponent, FallbackBlockComponent],
  template: `
    <h2>CSV Block Example (Buttons from CSV)</h2>
    <p>This example demonstrates a CSV block that renders as buttons based on comma-separated values.</p>
    <app-llm-output-display
      [llmOutput]="streamedOutput"
      [isStreamFinished]="isStreamFinished"
      [blocks]="definedBlocks"
      [fallbackBlock]="definedFallbackBlock">
    </app-llm-output-display>
    <button (click)="restartStream()" [disabled]="!isStreamFinished && streamInterval !== null">Restart Stream</button>
    <hr>
    <p><strong>Original LLM Output (simulated stream):</strong></p>
    <pre style="white-space: pre-wrap; background: #f4f4f4; padding: 10px;">{{ exampleLlmOutput }}</pre>
  `
})
export class CsvExampleComponent implements OnInit, OnDestroy {
  exampleLlmOutput = `
## CSV Example
Some markdown text here.
And now for a CSV block that should become buttons:
⦅buttons,First Button,Second Button,Another One⦆
This text comes after the CSV block.
`; // Delimiters are ⦅ and ⦆, type is "buttons"

  streamedOutput = "";
  isStreamFinished = false;
  
  definedBlocks!: LLMOutputBlock[];
  definedFallbackBlock!: LLMOutputFallbackBlock;
  
  // Specific options for this CSV block example
  // These options are used by the matchers and lookback.
  // The CsvButtonsComponent will also need to be aware of these,
  // ideally by having these options passed to it.
  private csvButtonOptions: CsvBlockOptions = {
    type: 'buttons', 
    // Using default delimiters from defaultCsvOptions: startChar: '⦅', endChar: '⦆', delimiter: ','
    // These match the exampleLlmOutput string.
  };

  streamInterval: any = null;
  private currentIndex = 0;
  private readonly chunkSize = 10;
  private readonly intervalMs = 50;

  constructor() {
    this.definedBlocks = [
      {
        component: CsvButtonsComponent as Type<any>,
        ...getCsvMatchers(this.csvButtonOptions),
        lookBack: getCsvLookBack(this.csvButtonOptions),
        // To pass options to CsvButtonsComponent for its internal parsing:
        // 1. Modify LLMOutputBlock to include an 'options' or 'props' field.
        // 2. Modify LlmOutputDisplayComponent to check for this field and pass it to ngComponentOutlet's inputs.
        // For now, CsvButtonsComponent was updated to use getEffectiveOptions which defaults to 'buttons' type
        // and default delimiters, which matches this.csvButtonOptions here.
      }
    ];

    this.definedFallbackBlock = {
      component: FallbackBlockComponent as Type<any>,
      lookBack: getMarkdownLookBack()
    };
  }

  ngOnInit(): void { this.startStream(); }
  
  startStream(): void { 
    this.currentIndex = 0;
    this.streamedOutput = "";
    this.isStreamFinished = false;
    if (this.streamInterval) clearInterval(this.streamInterval);
    this.streamInterval = setInterval(() => {
      if (this.currentIndex < this.exampleLlmOutput.length) {
        const nextChunkEnd = Math.min(this.currentIndex + this.chunkSize, this.exampleLlmOutput.length);
        this.streamedOutput += this.exampleLlmOutput.substring(this.currentIndex, nextChunkEnd);
        this.currentIndex = nextChunkEnd;
      } else {
        this.streamedOutput = this.exampleLlmOutput; // Ensure full output at end
        this.isStreamFinished = true;
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
    }, this.intervalMs);
  }
  
  restartStream(): void { this.startStream(); }
  
  ngOnDestroy(): void { if (this.streamInterval) clearInterval(this.streamInterval); }
}
