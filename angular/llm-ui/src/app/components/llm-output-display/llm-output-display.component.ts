import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
import { LlmOutputService, LlmOutputServiceState } from '../../services/llm-output.service'; // Adjust path
import { BlockMatch, LLMOutputBlock, LLMOutputFallbackBlock, LLMOutputComponent } from '../../models/llm-output-types'; // Adjust path
import { FallbackBlockComponent } from '../fallback-block/fallback-block.component'; // Adjust path
import { TextBlockComponent } from '../text-block/text-block.component'; // Adjust path
import { JsonBlockComponent } from '../json-block/json-block.component';
import { CsvBlockComponent } from '../csv-block/csv-block.component';
import { CodeBlockComponent } from '../code-block/code-block.component'; // ADD THIS

@Component({
  selector: 'app-llm-output-display',
  standalone: true,
  imports: [CommonModule, FallbackBlockComponent, TextBlockComponent, JsonBlockComponent, CsvBlockComponent, CodeBlockComponent], // ADD CodeBlockComponent HERE
  templateUrl: './llm-output-display.component.html',
  styleUrls: ['./llm-output-display.component.css'],
  // providers: [LlmOutputService] // LlmOutputService is providedIn: 'root'
})
export class LlmOutputDisplayComponent implements OnInit, OnDestroy, OnChanges {
  @Input() llmOutput = '';
  @Input() isStreamFinished = false;
  @Input() blocks: LLMOutputBlock[] = []; // Define how blocks are passed, e.g. text, button
  @Input() fallbackBlock!: LLMOutputFallbackBlock; // To be defined by parent

  public state$: Observable<LlmOutputServiceState>;
  private serviceStateSubscription!: Subscription;

  constructor(public llmOutputService: LlmOutputService) {
    this.state$ = this.llmOutputService.state$;
  }

  ngOnInit(): void {
    const defaultFallbackComponent = FallbackBlockComponent; 
    const finalFallbackBlock = this.fallbackBlock || {
      component: defaultFallbackComponent,
      lookBack: (params) => ({ output: params.output, visibleText: params.output }),
    };

    this.llmOutputService.initialize(
      this.blocks,
      finalFallbackBlock
    );

    if (this.llmOutput) {
      this.llmOutputService.setLlmOutput(this.llmOutput, this.isStreamFinished);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    let newLlmOutput: string | undefined;
    let newIsStreamFinished: boolean | undefined;

    if (changes['llmOutput']) {
      newLlmOutput = changes['llmOutput'].currentValue;
    }
    if (changes['isStreamFinished']) {
      newIsStreamFinished = changes['isStreamFinished'].currentValue;
    }

    if (newLlmOutput !== undefined || newIsStreamFinished !== undefined) {
      this.llmOutputService.setLlmOutput(
        newLlmOutput !== undefined ? newLlmOutput : this.llmOutput,
        newIsStreamFinished !== undefined ? newIsStreamFinished : this.isStreamFinished
      );
    }

    if (changes['blocks'] || changes['fallbackBlock']) {
        const defaultFallbackComponent = FallbackBlockComponent;
        const finalFallbackBlock = this.fallbackBlock || {
          component: defaultFallbackComponent,
          lookBack: (params) => ({ output: params.output, visibleText: params.output }),
        };
        this.llmOutputService.initialize(
          this.blocks,
          finalFallbackBlock
        );
    }
  }

  getComponentType(blockMatch: BlockMatch): Type<any> | null {
    if (blockMatch && blockMatch.block && blockMatch.block.component) {
      return blockMatch.block.component;
    }
    return FallbackBlockComponent; 
  }

  ngOnDestroy(): void {
    if (this.serviceStateSubscription) {
      this.serviceStateSubscription.unsubscribe();
    }
    this.llmOutputService.ngOnDestroy(); 
  }
}
