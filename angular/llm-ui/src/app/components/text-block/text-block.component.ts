import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { BlockMatch } from '../../models/llm-output-types';

@Component({
  selector: 'app-text-block',
  standalone: true, // Add standalone: true
  imports: [CommonModule], // Import CommonModule for *ngIf
  templateUrl: './text-block.component.html',
  styleUrls: ['./text-block.component.css']
})
export class TextBlockComponent {
  @Input() blockMatch!: BlockMatch;
}
