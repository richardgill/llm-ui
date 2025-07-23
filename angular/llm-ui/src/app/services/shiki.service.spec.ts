import { TestBed } from '@angular/core/testing';
import { ShikiService } from './shiki.service';
import * as shikiCore from 'shiki/core'; // To spy on getHighlighterCore

describe('ShikiService', () => {
  let service: ShikiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ShikiService],
    });
    service = TestBed.inject(ShikiService);
  });

  afterEach(() => {
    // Clean up spies
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getHighlighter should attempt to initialize and return a highlighter promise', async () => {
    const mockHighlighter = { 
      codeToHtml: jest.fn(() => ''), 
      getLoadedThemes: jest.fn(() => []), 
      getLoadedLanguages: jest.fn(() => []) 
    };
    
    const getHighlighterCoreSpy = jest.spyOn(shikiCore, 'getHighlighterCore')
                                     .mockResolvedValue(mockHighlighter as any);
    
    const highlighter = await service.getHighlighter();
    expect(highlighter).toBeDefined();
    expect(getHighlighterCoreSpy).toHaveBeenCalled();
    // Check if it's memoized for subsequent calls
    const highlighter2 = await service.getHighlighter();
    expect(highlighter2).toBe(highlighter); // Should be same instance
    expect(getHighlighterCoreSpy).toHaveBeenCalledTimes(1); // Should only initialize once
  });

  it('getHighlighterSync should return undefined initially', () => {
    expect(service.getHighlighterSync()).toBeUndefined();
  });

  it('getHighlighterSync should return instance after promise resolves', async () => {
    const mockHighlighter = { 
      codeToHtml: jest.fn(() => ''), 
      getLoadedThemes: jest.fn(() => []), 
      getLoadedLanguages: jest.fn(() => []) 
    };
    const getHighlighterCoreSpy = jest.spyOn(shikiCore, 'getHighlighterCore')
                                     .mockResolvedValue(mockHighlighter as any);

    await service.getHighlighter(); // Initialize and wait for it
    expect(service.getHighlighterSync()).toBe(mockHighlighter as any);
  });

  it('getHighlighter should handle initialization errors', async () => {
    const testError = new Error('Shiki init failed');
    const getHighlighterCoreSpy = jest.spyOn(shikiCore, 'getHighlighterCore')
                                       .mockRejectedValue(testError);

    await expect(service.getHighlighter()).rejects.toThrow('Shiki init failed');
    // Ensure it doesn't keep retrying indefinitely or return a bad state
    await expect(service.getHighlighter()).rejects.toThrow('Shiki init failed'); // Second call should also reject
    expect(getHighlighterCoreSpy).toHaveBeenCalledTimes(1); // Should only attempt initialization once if it fails critically
  });
});
