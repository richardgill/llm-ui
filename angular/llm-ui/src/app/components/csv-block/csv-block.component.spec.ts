import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { CsvBlockComponent } from './csv-block.component';
import { BlockMatch, LLMOutputFallbackBlock } from '../../models/llm-output-types';
import { Type } from '@angular/core';

class MockHostComponent {} // For BlockMatch.block type

describe('CsvBlockComponent', () => {
  let component: CsvBlockComponent;
  let fixture: ComponentFixture<CsvBlockComponent>;

  const mockBlockDefinition: LLMOutputFallbackBlock = { // Using Fallback as a stand-in
    component: MockHostComponent as Type<any>,
    lookBack: (params) => ({ output: params.output, visibleText: params.output }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, CsvBlockComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CsvBlockComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display output when blockMatch is provided and isVisible is true', () => {
    const mockMatch: BlockMatch = {
      block: mockBlockDefinition,
      priority: 0,
      llmOutput: "Full CSV output",
      isComplete: true,
      startIndex: 0,
      endIndex: 10,
      outputRaw: "val1,val2",
      output: "val1,val2",
      visibleText: "val1,val2",
      isVisible: true,
    };
    component.blockMatch = mockMatch;
    fixture.detectChanges();
    const preElement = fixture.nativeElement.querySelector('pre');
    expect(preElement.textContent).toContain('val1,val2');
  });

  it('should not display when isVisible is false', () => {
    const mockMatch: BlockMatch = {
      block: mockBlockDefinition,
      priority: 0,
      llmOutput: "Full CSV output",
      isComplete: true,
      startIndex: 0,
      endIndex: 10,
      outputRaw: "val1,val2",
      output: "val1,val2",
      visibleText: "val1,val2",
      isVisible: false,
    };
    component.blockMatch = mockMatch;
    fixture.detectChanges();
    const preElement = fixture.nativeElement.querySelector('pre');
    expect(preElement).toBeNull();
  });
});
