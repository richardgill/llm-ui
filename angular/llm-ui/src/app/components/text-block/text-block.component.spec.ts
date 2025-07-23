import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { TextBlockComponent } from './text-block.component';
import { BlockMatch, LLMOutputBlock } from '../../models/llm-output-types';
import { Type } from '@angular/core';

// Mock for the component type in LLMOutputBlock
class MockHostComponent {}

describe('TextBlockComponent', () => {
  let component: TextBlockComponent;
  let fixture: ComponentFixture<TextBlockComponent>;

  const mockTextBlockDefinition: LLMOutputBlock = {
    component: MockHostComponent as Type<any>, // Not directly used by TextBlockComponent itself
    lookBack: (params) => ({ output: params.output, visibleText: params.output }),
    findCompleteMatch: (input) => undefined, // Dummy implementation
    findPartialMatch: (input) => undefined,  // Dummy implementation
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, TextBlockComponent], // TextBlockComponent is standalone
    })
    .compileComponents();

    fixture = TestBed.createComponent(TextBlockComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display visibleText when blockMatch is provided and isVisible is true', () => {
    const mockMatch: BlockMatch = {
      block: mockTextBlockDefinition,
      priority: 0,
      llmOutput: "Full output",
      isComplete: true,
      startIndex: 0,
      endIndex: 12,
      outputRaw: "Display this",
      output: "Display this",
      visibleText: "Display this",
      isVisible: true,
    };
    component.blockMatch = mockMatch;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain("Display this");
  });

  it('should not display text when blockMatch is provided but isVisible is false', () => {
    const mockMatch: BlockMatch = {
      block: mockTextBlockDefinition,
      priority: 0,
      llmOutput: "Full output",
      isComplete: true,
      startIndex: 0,
      endIndex: 12,
      outputRaw: "Do not display",
      output: "Do not display",
      visibleText: "Do not display",
      isVisible: false,
    };
    component.blockMatch = mockMatch;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    // The component has a div with class "text-block", so textContent won't be empty.
    // We need to check the content of that div.
    const textBlockDiv = fixture.nativeElement.querySelector('.text-block');
    expect(textBlockDiv.textContent?.trim()).toBe('');
  });

  it('should not display text when blockMatch is undefined', () => {
    // @ts-ignore
    component.blockMatch = undefined;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const textBlockDiv = fixture.nativeElement.querySelector('.text-block');
    expect(textBlockDiv.textContent?.trim()).toBe('');
  });
});
