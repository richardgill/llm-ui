import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component, Input, Type, SimpleChange } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

import { LlmOutputDisplayComponent } from './llm-output-display.component';
import { LlmOutputService, LlmOutputServiceState } from '../../services/llm-output.service';
import { BlockMatch, LLMOutputBlock, LLMOutputFallbackBlock } from '../../models/llm-output-types';
import { FallbackBlockComponent } from '../fallback-block/fallback-block.component';
import { TextBlockComponent } from '../text-block/text-block.component';

// Mock child components
@Component({
  selector: 'app-mock-fallback',
  template: '<div>Mock Fallback: {{ blockMatch?.visibleText }}</div>',
  standalone: true,
  imports: [CommonModule]
})
class MockFallbackComponent {
  @Input() blockMatch!: BlockMatch;
}

@Component({
  selector: 'app-mock-text',
  template: '<div>Mock Text: {{ blockMatch?.visibleText }}</div>',
  standalone: true,
  imports: [CommonModule]
})
class MockTextComponent {
  @Input() blockMatch!: BlockMatch;
}

const mockDefaultFallbackBlockDefinition: LLMOutputFallbackBlock = {
  component: MockFallbackComponent as Type<any>,
  lookBack: (params) => ({ output: params.output, visibleText: params.output.slice(0, params.visibleTextLengthTarget) }),
};

const mockTextBlockDefinition: LLMOutputBlock = {
  component: MockTextComponent as Type<any>,
  findCompleteMatch: (input) => null,
  findPartialMatch: (input) => null,
  lookBack: (params) => ({ output: params.output, visibleText: params.output.slice(0, params.visibleTextLengthTarget) }),
};


describe('LlmOutputDisplayComponent', () => {
  let component: LlmOutputDisplayComponent;
  let fixture: ComponentFixture<LlmOutputDisplayComponent>;
  let mockLlmOutputService: Partial<LlmOutputService>;
  let stateSubject: BehaviorSubject<LlmOutputServiceState>;

  beforeEach(async () => {
    stateSubject = new BehaviorSubject<LlmOutputServiceState>({
      blockMatches: [],
      isFinished: false,
      visibleText: '',
      finishCount: 0,
    });

    mockLlmOutputService = {
      state$: stateSubject.asObservable(),
      initialize: jasmine.createSpy('initialize'),
      setLlmOutput: jasmine.createSpy('setLlmOutput'),
      ngOnDestroy: jasmine.createSpy('ngOnDestroy'), // Make sure to spy on this if called
    };

    await TestBed.configureTestingModule({
      imports: [CommonModule, LlmOutputDisplayComponent], // LlmOutputDisplayComponent is standalone
      // It imports FallbackBlockComponent and TextBlockComponent for its template's ngComponentOutlet,
      // but for testing getComponentType, we don't strictly need them compiled if we mock correctly.
      // However, LlmOutputDisplayComponent itself imports them in its `imports` array.
      providers: [
        { provide: LlmOutputService, useValue: mockLlmOutputService },
      ],
    })
    // Override standalone components for testing if LlmOutputDisplayComponent imports real ones
    // For this test, FallbackBlockComponent and TextBlockComponent are imported by LlmOutputDisplayComponent,
    // so they are part of its testing module.
    .overrideComponent(LlmOutputDisplayComponent, {
        remove: { imports: [FallbackBlockComponent, TextBlockComponent] },
        add: { imports: [MockFallbackComponent, MockTextComponent] } // Use mocks for template testing
    })
    .compileComponents();

    fixture = TestBed.createComponent(LlmOutputDisplayComponent);
    component = fixture.componentInstance;
    // Provide a default fallback block for ngOnInit if not overridden by input
    component.fallbackBlock = mockDefaultFallbackBlockDefinition; 
    fixture.detectChanges(); // Trigger ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize LlmOutputService on ngOnInit', () => {
    expect(mockLlmOutputService.initialize).toHaveBeenCalledWith(component.blocks, component.fallbackBlock);
  });

  it('should call LlmOutputService.setLlmOutput on ngOnChanges if llmOutput changes', () => {
    component.llmOutput = "new output";
    component.isStreamFinished = false;
    component.ngOnChanges({
      llmOutput: new SimpleChange(null, component.llmOutput, true)
    });
    expect(mockLlmOutputService.setLlmOutput).toHaveBeenCalledWith("new output", false);
  });

  it('should call LlmOutputService.initialize on ngOnChanges if blocks input changes', () => {
    const newBlocks: LLMOutputBlock[] = [mockTextBlockDefinition];
    component.blocks = newBlocks;
    component.ngOnChanges({
      blocks: new SimpleChange(null, component.blocks, true)
    });
    expect(mockLlmOutputService.initialize).toHaveBeenCalledWith(newBlocks, component.fallbackBlock);
  });

  it('should update display when LlmOutputService state emits new blockMatches', fakeAsync(() => {
    const matches: BlockMatch[] = [
      { block: mockTextBlockDefinition, outputRaw: 'Text1', visibleText: 'Text1', isVisible: true, priority:0, llmOutput:"Text1", isComplete:true, startIndex:0, endIndex:5, output:"Text1" },
      { block: mockDefaultFallbackBlockDefinition, outputRaw: 'Fallback1', visibleText: 'Fallback1', isVisible: true, priority:1, llmOutput:"Fallback1", isComplete:true, startIndex:5, endIndex:15, output:"Fallback1"},
    ];
    stateSubject.next({ blockMatches: matches, isFinished: true, visibleText: 'Text1Fallback1', finishCount: 1 });
    
    fixture.detectChanges(); // Update view with new state
    tick(); // allow async operations like ngComponentOutlet to process
    fixture.detectChanges(); // one more detectChanges after tick

    const compiled = fixture.nativeElement as HTMLElement;
    // These selectors depend on the mock components' templates
    expect(compiled.querySelector('app-mock-text')).toBeTruthy();
    expect(compiled.textContent).toContain('Mock Text: Text1');
    expect(compiled.querySelector('app-mock-fallback')).toBeTruthy();
    expect(compiled.textContent).toContain('Mock Fallback: Fallback1');
  }));

  it('getComponentType should return correct component type from blockMatch', () => {
    const textMatch: BlockMatch = { block: mockTextBlockDefinition, outputRaw: '', visibleText: '', isVisible: true, priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, output:"" };
    const fallbackMatch: BlockMatch = { block: mockDefaultFallbackBlockDefinition, outputRaw: '', visibleText: '', isVisible: true, priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, output:"" };
    
    expect(component.getComponentType(textMatch)).toBe(MockTextComponent);
    expect(component.getComponentType(fallbackMatch)).toBe(MockFallbackComponent);
  });

  it('getComponentType should return default FallbackBlockComponent if component is missing in blockMatch', () => {
    const badMatch: BlockMatch = {
      // @ts-ignore Simulate a block definition where component is null
      block: { ...mockDefaultFallbackBlockDefinition, component: null }, 
      outputRaw: '', visibleText: '', isVisible: true, priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, output:""
    };
    // The getComponentType method in LlmOutputDisplayComponent has a hardcoded 'return FallbackBlockComponent;'
    // This refers to the actual FallbackBlockComponent, not the mock, due to JavaScript's lexical scoping.
    // To test this properly, we would need to ensure the 'FallbackBlockComponent' it refers to is the one we expect.
    // However, since LlmOutputDisplayComponent itself imports the real FallbackBlockComponent, this is the type it will use.
    // This test is verifying that if a blockMatch.block.component is null, it defaults to the real FallbackBlockComponent type.
    expect(component.getComponentType(badMatch)).toBe(FallbackBlockComponent);
  });


  it('should call LlmOutputService.ngOnDestroy on ngOnDestroy', () => {
    component.ngOnDestroy();
    expect(mockLlmOutputService.ngOnDestroy).toHaveBeenCalled();
  });
});
