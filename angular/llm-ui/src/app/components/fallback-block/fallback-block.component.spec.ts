import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FallbackBlockComponent } from './fallback-block.component';
import { BlockMatch, LLMOutputFallbackBlock } from '../../models/llm-output-types';
import { Type } from '@angular/core';

// Mock for the component type in LLMOutputFallbackBlock
class MockHostComponent {}

describe('FallbackBlockComponent', () => {
  let component: FallbackBlockComponent;
  let fixture: ComponentFixture<FallbackBlockComponent>;

  const mockFallbackBlockDefinition: LLMOutputFallbackBlock = {
    component: MockHostComponent as Type<any>, // Not directly used by FallbackBlockComponent itself but part of the type
    lookBack: (params) => ({ output: params.output, visibleText: params.output }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FallbackBlockComponent], // FallbackBlockComponent is standalone
    })
    .compileComponents();

    fixture = TestBed.createComponent(FallbackBlockComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display visibleText when blockMatch is provided and isVisible is true', () => {
    const mockMatch: BlockMatch = {
      block: mockFallbackBlockDefinition,
      priority: 0,
      llmOutput: "Full output",
      isComplete: true,
      startIndex: 0,
      endIndex: 10,
      outputRaw: "Visible text",
      output: "Visible text",
      visibleText: "Visible text",
      isVisible: true,
    };
    component.blockMatch = mockMatch;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain("Visible text");
  });

  it('should not display text when blockMatch is provided but isVisible is false', () => {
    const mockMatch: BlockMatch = {
      block: mockFallbackBlockDefinition,
      priority: 0,
      llmOutput: "Full output",
      isComplete: true,
      startIndex: 0,
      endIndex: 10,
      outputRaw: "Hidden text",
      output: "Hidden text",
      visibleText: "Hidden text",
      isVisible: false,
    };
    component.blockMatch = mockMatch;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent?.trim()).toBe('');
  });

  it('should not display text when blockMatch is undefined', () => {
    // @ts-ignore
    component.blockMatch = undefined;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent?.trim()).toBe('');
  });
});
