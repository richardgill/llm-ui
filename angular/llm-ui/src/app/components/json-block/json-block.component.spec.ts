import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { JsonBlockComponent } from './json-block.component';
import { BlockMatch, LLMOutputFallbackBlock } from '../../models/llm-output-types'; // Using Fallback for mock type
import { Type } from '@angular/core';

class MockHostComponent {}

describe('JsonBlockComponent', () => {
  let component: JsonBlockComponent;
  let fixture: ComponentFixture<JsonBlockComponent>;

  const mockBlockDefinition: LLMOutputFallbackBlock = { // Using Fallback as a stand-in for BlockMatch.block type
    component: MockHostComponent as Type<any>,
    lookBack: (params) => ({ output: params.output, visibleText: params.output }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, JsonBlockComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(JsonBlockComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display output when blockMatch is provided and isVisible is true', () => {
    const mockMatch: BlockMatch = {
      block: mockBlockDefinition,
      priority: 0,
      llmOutput: "Full JSON output",
      isComplete: true,
      startIndex: 0,
      endIndex: 20,
      outputRaw: "{ \"key\": \"value\" }",
      output: "{ \"key\": \"value\" }",
      visibleText: "{ \"key\": \"value\" }",
      isVisible: true,
    };
    component.blockMatch = mockMatch;
    fixture.detectChanges();
    const preElement = fixture.nativeElement.querySelector('pre');
    expect(preElement.textContent).toContain('{ "key": "value" }');
  });

  it('should not display when isVisible is false', () => {
    const mockMatch: BlockMatch = {
      block: mockBlockDefinition,
      priority: 0,
      llmOutput: "Full JSON output",
      isComplete: true,
      startIndex: 0,
      endIndex: 20,
      outputRaw: "{ \"key\": \"value\" }",
      output: "{ \"key\": \"value\" }",
      visibleText: "{ \"key\": \"value\" }",
      isVisible: false,
    };
    component.blockMatch = mockMatch;
    fixture.detectChanges();
    const preElement = fixture.nativeElement.querySelector('pre');
    expect(preElement).toBeNull();
  });
});
