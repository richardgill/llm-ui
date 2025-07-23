import { Component, Input, OnChanges, SimpleChanges } from '@angular/core'; // Added OnChanges, SimpleChanges
import { CommonModule } from '@angular/common';
import { BlockMatch } from '../../models/llm-output-types';
import { parseJson5 } from '../../utils/json-block-utils'; // Assuming this path

// Simplified interface for button data for this component
interface ButtonData {
  text: string;
}

interface ButtonsJson {
  type: 'buttons';
  buttons: ButtonData[];
}

@Component({
  selector: 'app-buttons-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="blockMatch && blockMatch.isVisible && parsedButtons" class="buttons-block">
      <button *ngFor="let button of parsedButtons.buttons; let i = index" [attr.data-index]="i">
        {{ button.text }}
      </button>
    </div>
    <div *ngIf="blockMatch && blockMatch.isVisible && parseError" class="buttons-error">
      <p>Error parsing buttons JSON:</p>
      <pre>{{ parseError }}</pre>
    </div>
  `,
  styles: [`
    .buttons-block button { margin: 4px; padding: 8px 12px; border: 1px solid #ccc; background-color: #f0f0f0; cursor: pointer; }
    .buttons-block button:hover { background-color: #e0e0e0; }
    .buttons-error { color: red; border: 1px solid red; padding: 8px; }
  `]
})
export class ButtonsBlockComponent implements OnChanges { // Implemented OnChanges
  @Input() blockMatch!: BlockMatch;

  parsedButtons: ButtonsJson | null = null;
  parseError: string | null = null;

  ngOnChanges(changes: SimpleChanges): void { // Added SimpleChanges type
    if (changes['blockMatch']) { // Check if blockMatch input changed
        this.parseError = null;
        this.parsedButtons = null;
        const currentBlockMatch = changes['blockMatch'].currentValue;
        if (currentBlockMatch && currentBlockMatch.output) {
          try {
            // blockMatch.output for JSON blocks is typically the raw JSON string (content part)
            // from the lookBack function of getJsonLookBack.
            // The getJsonLookBack from json-block-utils.ts currently stringifies the *processed* object.
            // For ButtonsBlockComponent, we need the *original* content or ensure lookBack output is parseable.
            // Let's assume blockMatch.output is the string to be parsed.
            // If blockMatch.output is already a parsed object from a smarter lookBack, this would need adjustment.
            // Given current getJsonLookBack, output is JSON.stringify(objectForProcessing, null, 2).
            // So, parseJson5 should still work.
            const jsonData = parseJson5(currentBlockMatch.output); 
            if (jsonData && jsonData.type === 'buttons' && Array.isArray(jsonData.buttons)) {
              // Basic validation for button text
              const isValidButtons = jsonData.buttons.every((btn: any) => typeof btn.text === 'string');
              if (isValidButtons) {
                this.parsedButtons = jsonData as ButtonsJson;
              } else {
                this.parseError = "Invalid button data structure: all buttons must have a text property.";
              }
            } else {
              this.parseError = "Invalid data structure or missing 'type: buttons'. Expected JSON: " + currentBlockMatch.output;
            }
          } catch (e: any) {
            this.parseError = (e.message || 'Unknown parsing error.') + " Input: " + currentBlockMatch.output;
          }
        }
    }
  }
}
