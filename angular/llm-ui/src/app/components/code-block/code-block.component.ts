import { Component, Input, OnChanges, SimpleChanges, SecurityContext, OnInit, OnDestroy } from '@angular/core'; // Added OnInit, OnDestroy
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs'; // Added Subscription
import { BlockMatch } from '../../models/llm-output-types';
import { parseCodeBlock, CodeBlockData } from '../../utils/code-block-utils';
import { ShikiService } from '../../services/shiki.service'; // Import ShikiService
import { HighlighterCore } from 'shiki/core'; // Import HighlighterCore type

@Component({
  selector: 'app-code-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="blockMatch && blockMatch.isVisible" class="code-block">
      <pre [innerHTML]="highlightedHtml"></pre>
    </div>
  `,
  styles: [`
    .code-block pre { background-color: #f5f5f5; /* Default if theme not loaded */ padding: 1em; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; }
    /* Shiki themes typically inject their own styles for background and colors. */
    /* Ensure Shiki's CSS (e.g., shiki-themes.css or inline styles from codeToHtml) is active. */
  `]
})
export class CodeBlockComponent implements OnChanges, OnInit, OnDestroy {
  @Input() blockMatch!: BlockMatch;

  public highlightedHtml: SafeHtml = '';
  private rawCode: string = '';
  private language: string | undefined;
  private highlighter: HighlighterCore | undefined;
  // private shikiSubscription: Subscription | undefined; // Not used with .then() approach

  constructor(
    private sanitizer: DomSanitizer,
    private shikiService: ShikiService
  ) {}

  ngOnInit(): void {
    // Attempt to get highlighter synchronously if already loaded
    this.highlighter = this.shikiService.getHighlighterSync();
    if (!this.highlighter) {
      // If not, subscribe to the promise from the service
      this.shikiService.getHighlighter().then(hl => {
        this.highlighter = hl;
        this.highlightCode(); // Highlight if code is already set from ngOnChanges
      }).catch(error => {
        console.error("Shiki highlighter failed to load in CodeBlockComponent:", error);
        this.useFallbackHighlighting(); // Fallback if highlighter fails
      });
    } else {
        // If highlighter was ready synchronously, and code might have been set by an early ngOnChanges
        this.highlightCode(); 
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['blockMatch']) {
      const currentMatch = changes['blockMatch'].currentValue;
      if (currentMatch && currentMatch.output) {
        const parsed: CodeBlockData = parseCodeBlock(currentMatch.output);
        this.rawCode = parsed.code || '';
        this.language = parsed.language;
        this.highlightCode();
      } else {
        this.highlightedHtml = '';
        this.rawCode = '';
        this.language = undefined;
      }
    }
  }

  private highlightCode(): void {
    if (this.rawCode && this.highlighter) {
      try {
        // Ensure language is loaded, default to 'plaintext'
        const langToUse = this.language && this.highlighter.getLoadedLanguages().includes(this.language as any) 
                          ? this.language 
                          : 'plaintext';
        const html = this.highlighter.codeToHtml(this.rawCode, { 
            lang: langToUse,
            // theme: 'nord' // Theme is usually set globally during Shiki init or taken from a default.
                           // Specifying theme here overrides the getHighlighter's theme array.
                           // It's better to rely on themes loaded by getHighlighter.
        });
        this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      } catch (error) {
        console.error(`Error highlighting code with Shiki (lang: ${this.language}):`, error);
        this.useFallbackHighlighting();
      }
    } else if (this.rawCode) {
      // Highlighter not ready yet, or no raw code
      this.useFallbackHighlighting();
    } else {
      this.highlightedHtml = '';
    }
  }

  private useFallbackHighlighting(): void {
    // Fallback to sanitized raw code if Shiki fails or isn't ready
    this.highlightedHtml = this.sanitizer.sanitize(SecurityContext.HTML, this.rawCode) || '';
  }
  
  ngOnDestroy(): void {
    // No explicit RxJS subscription to unsubscribe from here if using .then() on promise
    // If an RxJS observable was used from ShikiService for continuous updates, it would be unsubscribed here.
    // The ShikiService itself is a root service, so it's not destroyed with this component.
  }
}
