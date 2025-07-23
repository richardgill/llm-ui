import { Component, Input, OnChanges, SimpleChanges } from '@angular/core'; // Added SimpleChanges
import { CommonModule } from '@angular/common';
import { BlockMatch } from '../../models/llm-output-types';
import { parseCsv, getCsvBlockOptions, CsvBlockOptions, CsvBlockOptionsComplete, defaultCsvOptions } from '../../utils/csv-block-utils'; // Added CsvBlockOptionsComplete, defaultCsvOptions

@Component({
  selector: 'app-csv-buttons-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="blockMatch && blockMatch.isVisible && buttonTexts.length > 0" class="csv-buttons-block">
      <button *ngFor="let text of buttonTexts; let i = index" [attr.data-index]="i">
        {{ text }}
      </button>
    </div>
    <div *ngIf="blockMatch && blockMatch.isVisible && parseError" class="csv-buttons-error">
      <p>Error parsing CSV for buttons:</p>
      <pre>{{ parseError }}</pre>
    </div>
  `,
  styles: [`
    .csv-buttons-block button { margin: 4px; padding: 8px 12px; border: 1px solid #777; background-color: #ddd; cursor: pointer; }
    .csv-buttons-block button:hover { background-color: #ccc; }
    .csv-buttons-error { color: orange; border: 1px solid orange; padding: 8px; }
  `]
})
export class CsvButtonsComponent implements OnChanges {
  @Input() blockMatch!: BlockMatch;
  @Input() options?: CsvBlockOptions; // Make options optional

  buttonTexts: string[] = [];
  parseError: string | null = null;

  private getEffectiveOptions(): CsvBlockOptionsComplete {
    // Use provided options or fall back to defaults that match the example's expectations
    // The 'type' is crucial and should ideally always be part of the options for this component if used.
    // If options are not passed, we assume a 'buttons' type for this component as a fallback.
    return getCsvBlockOptions(this.options || { type: 'buttons', ...defaultCsvOptions });
  }

  ngOnChanges(changes: SimpleChanges): void { // Added SimpleChanges type
    this.buttonTexts = [];
    this.parseError = null;
    
    // Process only if blockMatch has changed and is current.
    if (changes['blockMatch'] || (changes['options'] && this.blockMatch)) {
        const currentBlockMatch = this.blockMatch; // Use current value of blockMatch
        const effectiveOptions = this.getEffectiveOptions();

        if (currentBlockMatch && currentBlockMatch.output) {
          try {
            const { startChar, endChar, type, delimiter } = effectiveOptions;

            let contentToParse = currentBlockMatch.output;
            const expectedPrefix = `${startChar}${type}${delimiter}`;
            
            if (contentToParse.startsWith(expectedPrefix)) {
              contentToParse = contentToParse.substring(expectedPrefix.length);
            }
            // Check endChar only if it's defined in options (it is by default)
            if (effectiveOptions.endChar && contentToParse.endsWith(effectiveOptions.endChar)) {
              contentToParse = contentToParse.substring(0, contentToParse.length - effectiveOptions.endChar.length);
            }

            const parsedArray = parseCsv(contentToParse, effectiveOptions); 
            
            if (parsedArray.length > 0) {
              this.buttonTexts = parsedArray;
            } else {
              // Consider if an empty CSV (like "⦅buttons,⦆") should be an error or just no buttons.
              // If blockMatch.output was just "⦅buttons,⦆", contentToParse becomes "", parsedArray is [].
              this.parseError = "No button data found in CSV content.";
            }

          } catch (e: any) {
            this.parseError = (e.message || 'Unknown parsing error.') + ` Input: "${currentBlockMatch.output}"`;
          }
        }
    }
  }
}
