import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { LlmOutputService, LlmOutputServiceState } from './llm-output.service';
import { MarkdownParserService } from './markdown-parser.service';
import { LLMOutputBlock, LLMOutputFallbackBlock, BlockMatch, LLMOutputComponent } from '../models/llm-output-types';
import { Type } from '@angular/core'; // For LLMOutputComponent

// Mock Components for testing
class MockTextBlockComponent {}
class MockFallbackBlockComponent {}

describe('LlmOutputService', () => {
  let service: LlmOutputService;
  let markdownParserServiceMock: Partial<MarkdownParserService>;
  let ngZoneMock: Partial<NgZone>;
  let requestAnimationFrameSpy: jasmine.Spy;
  let cancelAnimationFrameSpy: jasmine.Spy;

  const mockDefaultFallbackBlock: LLMOutputFallbackBlock = {
    component: MockFallbackBlockComponent as Type<any>,
    lookBack: ({ output, isComplete, visibleTextLengthTarget }) => ({
      output,
      visibleText: output.slice(0, visibleTextLengthTarget),
    }),
  };

  const mockTextBlockDefinition: LLMOutputBlock = {
    component: MockTextBlockComponent as Type<any>,
    // Simple matcher: matches whole words surrounded by spaces or start/end of string
    findCompleteMatch: (input) => {
      const match = /^(\s|^)(\w+)(\s|$)/.exec(input);
      if (match) {
        return { startIndex: match.index + match[1].length, endIndex: match.index + match[1].length + match[2].length, outputRaw: match[2] };
      }
      return undefined;
    },
    findPartialMatch: (input) => { // Similar to complete for this mock
      const match = /^(\s|^)(\w+)/.exec(input); // Matches start of a word
      if (match) {
        return { startIndex: match.index + match[1].length, endIndex: match.index + match[1].length + match[2].length, outputRaw: match[2] };
      }
      return undefined;
    },
    lookBack: ({ output, isComplete, visibleTextLengthTarget }) => ({
      output,
      visibleText: output.slice(0, visibleTextLengthTarget),
    }),
  }};


  beforeEach(() => {
    markdownParserServiceMock = {
      // Add mock methods if needed, e.g., markdownToVisibleText
      markdownToVisibleText: jasmine.createSpy('markdownToVisibleText').and.callFake((md, isFinished) => md),
    };

    // Mock NgZone to run requestAnimationFrame immediately or control it
    ngZoneMock = {
      runOutsideAngular: jasmine.createSpy('runOutsideAngular').and.callFake((fn: () => any) => fn()),
      run: jasmine.createSpy('run').and.callFake((fn: () => any) => fn()),
    };

    requestAnimationFrameSpy = spyOn(window, 'requestAnimationFrame').and.callFake((callback) => {
      // Store callback and call it manually in tests using tick() or a direct call
      // For simplicity here, we might call it back soon or let test control it.
      // Returning a mock ID
      // In a real test environment with fakeAsync, you'd typically let tick manage this.
      // For these tests, we will call the callback via tick.
      let id = 0;
      id = setTimeout(() => callback(performance.now()), 0) as any; // Simulate async callback
      return id as any;
    });
    cancelAnimationFrameSpy = spyOn(window, 'cancelAnimationFrame').and.callFake((id: number | undefined) => {
      if (id) clearTimeout(id);
    });

    TestBed.configureTestingModule({
      providers: [
        LlmOutputService,
        { provide: MarkdownParserService, useValue: markdownParserServiceMock },
        { provide: NgZone, useValue: ngZoneMock },
      ],
    });
    service = TestBed.inject(LlmOutputService);
    service.initialize([], mockDefaultFallbackBlock); // Initialize with default fallback
  });

  afterEach(() => {
    service.ngOnDestroy(); // Clean up any running animations
    // Ensure all timers are cleared if any were set by RAF mock
    // This might be handled by fakeAsync's cleanup too.
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default state', (done) => {
    service.state$.subscribe(state => {
      expect(state.blockMatches).toEqual([]);
      expect(state.isFinished).toBe(false);
      expect(state.visibleText).toBe('');
      expect(state.finishCount).toBe(0);
      done();
    });
  });

  describe('setLlmOutput', () => {
    it('should update llmOutput and isStreamFinished properties', () => {
      service.setLlmOutput("Hello", false);
      // @ts-ignore // Accessing private members for test verification
      expect(service.llmOutput).toBe("Hello");
      // @ts-ignore
      expect(service.isStreamFinished).toBe(false);
    });

    it('should trigger renderLoop if output is provided and loop is not running', fakeAsync(() => {
      service.setLlmOutput("Test", false);
      tick(); // Process the requestAnimationFrame callback
      expect(requestAnimationFrameSpy).toHaveBeenCalled();
      // Note: The spy is on window.requestAnimationFrame.
      // The actual callback execution is what we're testing by its effects.
    }));

    it('should reset and not start loop if output is cleared after running', fakeAsync(() => {
      service.setLlmOutput("Initial", false);
      tick(); 
      
      // @ts-ignore
      service.visibleTextIncrements = [1]; 

      service.setLlmOutput("", false); // Clear output, stream not finished
      tick();

      // @ts-ignore
      expect(service.visibleTextIncrements.length).toBe(0); 
      let finalState: LlmOutputServiceState | undefined;
      service.state$.subscribe(state => finalState = state );
      expect(finalState?.visibleText).toBe(''); 
      expect(finalState?.blockMatches.length).toBe(0);
    }));
  });

  describe('renderLoop and matchBlocksInternal (basic fallback)', () => {
    it('should process simple text into a single fallback block when stream finishes', fakeAsync(() => {
      const testOutput = "Hello world";
      service.setLlmOutput(testOutput, false); 
      tick(); 

      let currentState: LlmOutputServiceState | undefined;
      const subscription = service.state$.subscribe(state => currentState = state);
      
      service.setLlmOutput(testOutput, true); // Finish stream
      tick(); 

      expect(currentState).toBeTruthy();
      expect(currentState?.isFinished).toBe(true);
      expect(currentState?.visibleText).toBe(testOutput);
      expect(currentState?.blockMatches.length).toBe(1);
      if (currentState?.blockMatches.length === 1) {
        const match = currentState!.blockMatches[0];
        expect(match.outputRaw).toBe(testOutput);
        expect(match.block.component).toBe(MockFallbackBlockComponent);
        expect(match.isComplete).toBe(true);
      }
      subscription.unsubscribe();
    }}));
  });
  
  describe('matchBlocksInternal with defined blocks', () => {
    it('should match a simple defined block', fakeAsync(() => {
      service.initialize([mockTextBlockDefinition], mockDefaultFallbackBlock);
      const testOutput = "word1"; 
      
      service.setLlmOutput(testOutput, false);
      tick();
      service.setLlmOutput(testOutput, true);
      tick();

      let currentState: LlmOutputServiceState | undefined;
      const subscription = service.state$.subscribe(state => currentState = state);

      expect(currentState).toBeTruthy();
      expect(currentState?.isFinished).toBe(true);
      expect(currentState?.visibleText).toBe("word1");
      expect(currentState?.blockMatches.length).toBe(1);
      if (currentState?.blockMatches.length === 1) {
        expect(currentState?.blockMatches[0].block.component).toBe(MockTextBlockComponent);
        expect(currentState?.blockMatches[0].outputRaw).toBe("word1");
      }
      subscription.unsubscribe();
    }));

    it('should use fallback for text not matching defined blocks', fakeAsync(() => {
      service.initialize([mockTextBlockDefinition], mockDefaultFallbackBlock);
      const testOutput = "--- notaword ---"; 
      
      service.setLlmOutput(testOutput, false);
      tick();
      service.setLlmOutput(testOutput, true);
      tick();

      let currentState: LlmOutputServiceState | undefined;
      const subscription = service.state$.subscribe(state => currentState = state);
      
      expect(currentState).toBeTruthy();
      expect(currentState?.isFinished).toBe(true);
      expect(currentState?.visibleText).toBe(testOutput);
      expect(currentState?.blockMatches.length).toBe(1);
      if (currentState?.blockMatches.length === 1) {
         expect(currentState?.blockMatches[0].block.component).toBe(MockFallbackBlockComponent);
      }
      subscription.unsubscribe();
    }));
  }});

  // More tests to come:
  // - Throttling behavior (will require more sophisticated RAF control)
  // - Partial matching
  // - Overlapping matches and priority
  // - Complex sequences of matches and fallbacks
  // - lookBack function effects on visibleText and output
  // - restart() behavior
});
