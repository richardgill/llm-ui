import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlockMatch } from '../../models/llm-output-types';

@Component({
  selector: 'app-csv-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="blockMatch && blockMatch.isVisible" class="csv-block">
      <pre>{{ blockMatch.output }}</pre> <!-- Basic display, can be enhanced later e.g. as a table -->
    </div>
  `,
  styles: [`.csv-block pre { white-space: pre-wrap; word-wrap: break-word; } `]
})
export class CsvBlockComponent {
  @Input() blockMatch!: BlockMatch;
}
