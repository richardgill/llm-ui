import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlockMatch } from '../../models/llm-output-types';

@Component({
  selector: 'app-json-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="blockMatch && blockMatch.isVisible" class="json-block">
      <pre>{{ blockMatch.output }}</pre>
    </div>
  `,
  styles: [`.json-block pre { white-space: pre-wrap; word-wrap: break-word; } `]
})
export class JsonBlockComponent {
  @Input() blockMatch!: BlockMatch;
}
