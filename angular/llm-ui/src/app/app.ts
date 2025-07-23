import { Component, OnDestroy, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { LlmOutputDisplayComponent } from './components/llm-output-display/llm-output-display.component';
import { LLMOutputBlock, LLMOutputFallbackBlock, MaybeLLMOutputMatch } from './models/llm-output-types';
import { TextBlockComponent } from './components/text-block/text-block.component';
import { FallbackBlockComponent } from './components/fallback-block/fallback-block.component';
import { JsonBlockComponent } from './components/json-block/json-block.component';
import { getJsonMatchers, getJsonLookBack, JsonBlockOptions } from './utils/json-block-utils';
import { CsvBlockComponent } from './components/csv-block/csv-block.component';
import { getCsvMatchers, getCsvLookBack, CsvBlockOptions } from './utils/csv-block-utils';
import { CodeBlockComponent } from './components/code-block/code-block.component';
import { getCodeBlockMatchers, getCodeBlockLookBack, CodeBlockOptions } from './utils/code-block-utils';
import { JsonExampleComponent } from './examples/json-example/json-example.component';
import { CsvExampleComponent } from './examples/csv-example/csv-example.component'; // Import CsvExampleComponent


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    LlmOutputDisplayComponent, 
    JsonExampleComponent,
    CsvExampleComponent // Add CsvExampleComponent here
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  title = 'llm-ui';
  
  // For the main kitchen sink demo
  testLlmOutput = "";
  testIsStreamFinished = false;
  public testBlocks: LLMOutputBlock[];
  public testFallbackBlock: LLMOutputFallbackBlock;
  fullText: string;
  chunkSize = 15;
  intervalMs = 80;
  private currentIndex = 0;
  private streamInterval: any;

  // View management
  currentView: 'kitchenSink' | 'jsonExample' | 'csvExample' = 'kitchenSink';

  constructor() {
    // --- Existing Kitchen Sink Block Definitions ---
    const keywordBlock: LLMOutputBlock = { component: TextBlockComponent as Type<any>,findCompleteMatch: (input: string): MaybeLLMOutputMatch => {const keyword = "keyword";const index = input.toLowerCase().indexOf(keyword.toLowerCase());if (index !== -1) return { startIndex: index, endIndex: index + keyword.length, outputRaw: input.substring(index, index + keyword.length) };return undefined;},findPartialMatch: (input: string): MaybeLLMOutputMatch => {const keyword = "keyword";for (let i = keyword.length; i > 0; i--) {const partialKeyword = keyword.substring(0, i);if (input.toLowerCase().startsWith(partialKeyword.toLowerCase())) return { startIndex: 0, endIndex: i, outputRaw: input.substring(0, i) };}return undefined;},lookBack: ({ output, isComplete, visibleTextLengthTarget }) => ({ output, visibleText: output.slice(0, visibleTextLengthTarget) }) };
    this.testFallbackBlock = { component: FallbackBlockComponent as Type<any>,lookBack: ({ output, isComplete, visibleTextLengthTarget }) => ({ output, visibleText: output.slice(0, visibleTextLengthTarget) }) };
    this.testBlocks = [keywordBlock];
    const userProfileOptions: JsonBlockOptions = { type: 'user_profile', startChar: 'JSON{', endChar: '}JSON', typeKey: 'messageType', defaultVisible: false, visibleKeyPaths: ['$.name', '$.details.age'] };
    const jsonUserProfileBlock: LLMOutputBlock = { component: JsonBlockComponent as Type<any>, ...getJsonMatchers(userProfileOptions), lookBack: getJsonLookBack(userProfileOptions) };
    this.testBlocks.push(jsonUserProfileBlock);
    const orderItemsOptions: CsvBlockOptions = { type: 'order_items', startChar: '[CSV|', endChar: '|CSV]', delimiter: '|', allIndexesVisible: false, visibleIndexes: [0, 2] };
    const csvOrderItemsBlock: LLMOutputBlock = { component: CsvBlockComponent as Type<any>, ...getCsvMatchers(orderItemsOptions), lookBack: getCsvLookBack(orderItemsOptions) };
    this.testBlocks.push(csvOrderItemsBlock);
    const codeBlockOptions: CodeBlockOptions = {};
    const codeDemoBlock: LLMOutputBlock = { component: CodeBlockComponent as Type<any>, ...getCodeBlockMatchers(codeBlockOptions), lookBack: getCodeBlockLookBack(codeBlockOptions) };
    this.testBlocks.push(codeDemoBlock);
    // --- End of Kitchen Sink Block Definitions ---

    this.fullText = "This is a sample sentence. This is a keyword. " +
                    "Now for some JSON: JSON{ \"messageType\": \"user_profile\", \"name\": \"Alice\", \"details\": { \"age\": 30, \"city\": \"Wonderland\" }, \"status\": \"active\" }JSON. " +
                    "And now for CSV: [CSV|order_items|SKU123|Laptop|1|999.99|Shipped|CSV]. " +
                    "Followed by a code block: ```javascript\nconsole.log('Hello from Code Block!');\nfunction test() { return true; }\n```\n" +
                    "Some final trailing text.";
    
    if (this.currentView === 'kitchenSink') {
        this.startStream();
    }
  }

  startStream(): void {
    if (this.currentView !== 'kitchenSink') return; 

    this.currentIndex = 0;
    this.testLlmOutput = "";
    this.testIsStreamFinished = false;
    if (this.streamInterval) clearInterval(this.streamInterval);
    this.streamInterval = setInterval(() => {
      if (this.currentIndex < this.fullText.length) {
        const nextChunkEnd = Math.min(this.currentIndex + this.chunkSize, this.fullText.length);
        this.testLlmOutput += this.fullText.substring(this.currentIndex, nextChunkEnd);
        this.currentIndex = nextChunkEnd;
      } else {
        this.testLlmOutput = this.fullText;
        this.testIsStreamFinished = true;
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
    }, this.intervalMs);
  }

  setView(view: 'kitchenSink' | 'jsonExample' | 'csvExample'): void {
    this.currentView = view;
    if (this.currentView === 'kitchenSink') {
      this.startStream();
    } else {
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
      // Clear kitchen sink specific output when switching to an example view
      this.testLlmOutput = ""; 
      this.testIsStreamFinished = false;
    }
  }

  ngOnDestroy(): void {
    if (this.streamInterval) clearInterval(this.streamInterval);
  }
}
