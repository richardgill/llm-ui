import { Injectable } from '@angular/core';
import { getHighlighterCore, HighlighterCore, BundledLanguage, BundledTheme } from 'shiki/core';
// import { getWasmInlined } from 'shiki/wasm'; // For inlined WASM option, not used here

// Note: Actual language and theme imports (e.g., import langJavascript from 'shiki/langs/javascript.mjs';)
// are usually not needed when passing string identifiers to getHighlighterCore,
// as it will attempt to lazy-load them based on the strings.
// However, this depends on Shiki's bundling and how its assets are made available.

@Injectable({
  providedIn: 'root',
})
export class ShikiService {
  private highlighterPromise: Promise<HighlighterCore> | undefined;
  private highlighterInstance: HighlighterCore | undefined;

  constructor() {
    // No explicit setWasm call here, relying on loadWasm within getHighlighterCore
    // or Shiki's default CDN behavior if loadWasm is not effective in all environments.
  }

  private async initializeHighlighter(): Promise<HighlighterCore> {
    if (this.highlighterInstance) {
      return this.highlighterInstance;
    }
    if (this.highlighterPromise) {
      return this.highlighterPromise;
    }

    this.highlighterPromise = getHighlighterCore({
      themes: [
        'nord', // Common theme, Shiki will attempt to load it.
        'github-dark',
        'github-light',
      ],
      langs: [
        'javascript', 
        'typescript', 
        'python',
        'html',
        'css',
        'json',
        'markdown',
        'java',
        'csharp',
        'php',
        'ruby',
        'go',
        'rust',
        'shellscript', // often 'bash' or 'sh' too
        'yaml',
        'sql'
        // For more specific imports if needed:
        // (await import('shiki/langs/javascript.mjs')).default 
      ],
      loadWasm: async () => {
        // This function needs to return the WebAssembly module or an ArrayBuffer.
        // Assumes `shiki_bg.wasm` is copied to `src/assets/shiki/shiki_bg.wasm`
        // and `angular.json` includes "src/assets" in the assets array.
        const response = await fetch('/assets/shiki/shiki_bg.wasm');
        return response.arrayBuffer();
      }
    }).then(highlighter => {
      this.highlighterInstance = highlighter;
      return highlighter;
    }).catch(error => {
      console.error("Shiki Highlighter Initialization Error:", error);
      // Prevent future attempts if initialization fails critically
      this.highlighterPromise = Promise.reject(error); // Ensure promise is rejected
      throw error; // Re-throw to allow callers to handle
    });
    return this.highlighterPromise;
  }

  public async getHighlighter(): Promise<HighlighterCore> {
    return this.initializeHighlighter();
  }

  public getHighlighterSync(): HighlighterCore | undefined {
    return this.highlighterInstance;
  }
}
