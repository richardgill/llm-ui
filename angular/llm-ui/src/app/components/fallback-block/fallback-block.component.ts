import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { BlockMatch } from '../../models/llm-output-types'; 

@Component({
  selector: 'app-fallback-block',
  standalone: true, // Add standalone: true
  imports: [CommonModule], // Import CommonModule for *ngIf
  templateUrl: './fallback-block.component.html',
  styleUrls: ['./fallback-block.component.css']
})
export class FallbackBlockComponent {
  @Input() blockMatch!: BlockMatch;
}
