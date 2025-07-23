import { Component, Type, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LlmOutputDisplayComponent } from '../../components/llm-output-display/llm-output-display.component';
import { LLMOutputBlock, LLMOutputFallbackBlock } from '../../models/llm-output-types';
import { ButtonsBlockComponent } from '../../components/buttons-block/buttons-block.component';
import { FallbackBlockComponent } from '../../components/fallback-block/fallback-block.component'; // Standard fallback
import { getJsonMatchers, getJsonLookBack, JsonBlockOptions } from '../../utils/json-block-utils';
import { getMarkdownLookBack } from '../../utils/markdown-block-utils'; // To be created or use default

@Component({
  selector: 'app-json-example',
  standalone: true,
  imports: [CommonModule, LlmOutputDisplayComponent, ButtonsBlockComponent, FallbackBlockComponent],
  template: `
    <h2>JSON Block Example (Buttons)</h2>
    <p>This example demonstrates a custom JSON block that renders as interactive buttons.</p>
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
export class JsonExampleComponent implements OnInit, OnDestroy {
  exampleLlmOutput = `
This is some introductory markdown text.
It can include various elements like **bold text**, _italic_, or lists:
- Item 1
- Item 2

Now, here comes a special JSON block for buttons:
【{"type":"buttons","buttons":[{"text":"Button A"}, {"text":"Button B"}, {"text":"Click Me!"}]}】

Some text after the JSON block.
And more markdown content.
`; // Delimiters are 【 and 】

  streamedOutput = "";
  isStreamFinished = false;
  
  definedBlocks!: LLMOutputBlock[];
  definedFallbackBlock!: LLMOutputFallbackBlock;

  streamInterval: any = null; // Initialize to null
  private currentIndex = 0;
  private readonly chunkSize = 10;
  private readonly intervalMs = 50;

  constructor() {
    const jsonButtonsOptions: JsonBlockOptions = {
      type: 'buttons', // Matches the 'type' in the JSON
      startChar: '【',
      endChar: '】',
      // Other JsonBlockOptions can be set here if needed (e.g., typeKey)
    };

    this.definedBlocks = [
      {
        component: ButtonsBlockComponent as Type<any>,
        ...getJsonMatchers(jsonButtonsOptions),
        lookBack: getJsonLookBack(jsonButtonsOptions),
      }
    ];

    this.definedFallbackBlock = {
      component: FallbackBlockComponent as Type<any>, 
      lookBack: getMarkdownLookBack() 
    };
  }

  ngOnInit(): void {
    this.startStream();
  }

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
        // this.streamedOutput = this.exampleLlmOutput; // Ensure full output at end
        this.isStreamFinished = true;
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
    }, this.intervalMs);
  }
  
  restartStream(): void {
    this.startStream();
  }

  ngOnDestroy(): void {
    if (this.streamInterval) clearInterval(this.streamInterval);
  }
}
