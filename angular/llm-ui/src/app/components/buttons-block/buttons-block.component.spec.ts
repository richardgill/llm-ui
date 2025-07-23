import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonsBlockComponent } from './buttons-block.component';
import { BlockMatch, LLMOutputFallbackBlock } from '../../models/llm-output-types';
import { Type, SimpleChange } from '@angular/core';
import { parseJson5 } from '../../utils/json-block-utils';

// Mock parseJson5 for some tests if direct output testing is preferred
// For this component, we're testing its reaction to parseJson5's output mostly.

describe('ButtonsBlockComponent', () => {
  let component: ButtonsBlockComponent;
  let fixture: ComponentFixture<ButtonsBlockComponent>;
  const mockBlockDef: LLMOutputFallbackBlock = { component: null as any, lookBack: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonsBlockComponent] // It's standalone
    })
    .compileComponents();

    fixture = TestBed.createComponent(ButtonsBlockComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should parse valid JSON and display buttons', () => {
    const jsonData = { type: 'buttons', buttons: [{ text: 'B1' }, { text: 'B2' }] };
    const blockMatchInput: BlockMatch = {
      block: mockBlockDef, 
      output: JSON.stringify(jsonData), // blockMatch.output is the stringified JSON
      isVisible: true, 
      priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
    };
    component.blockMatch = blockMatchInput;
    // Manually call ngOnChanges or trigger it with SimpleChanges
    component.ngOnChanges({ blockMatch: new SimpleChange(null, blockMatchInput, true) });
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent.trim()).toBe('B1');
    expect(buttons[1].textContent.trim()).toBe('B2');
    expect(component.parseError).toBeNull();
  });

  it('should display error for invalid JSON structure (missing buttons array)', () => {
    const jsonData = { type: 'buttons', items: [{ text: 'B1' }] }; // 'items' instead of 'buttons'
    const blockMatchInput: BlockMatch = {
      block: mockBlockDef, output: JSON.stringify(jsonData), isVisible: true,
      priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
    };
    component.blockMatch = blockMatchInput;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, blockMatchInput, true) });
    fixture.detectChanges();
    
    expect(fixture.nativeElement.querySelector('.buttons-error')).toBeTruthy();
    expect(component.parseError).toContain("Invalid data structure");
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('should display error for invalid button data (missing text property)', () => {
    const jsonData = { type: 'buttons', buttons: [{ label: 'B1' }] }; // 'label' instead of 'text'
    const blockMatchInput: BlockMatch = {
      block: mockBlockDef, output: JSON.stringify(jsonData), isVisible: true,
      priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
    };
    component.blockMatch = blockMatchInput;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, blockMatchInput, true) });
    fixture.detectChanges();
    
    expect(fixture.nativeElement.querySelector('.buttons-error')).toBeTruthy();
    expect(component.parseError).toContain("Invalid button data structure");
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('should display error for unparseable JSON string', () => {
    const blockMatchInput: BlockMatch = {
      block: mockBlockDef, output: "{ type: 'buttons', buttons: [", isVisible: true, // Malformed JSON
      priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
    }; 
    component.blockMatch = blockMatchInput;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, blockMatchInput, true) });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.buttons-error')).toBeTruthy();
    expect(component.parseError).toBeTruthy();
  });

  it('should not render if not visible', () => {
     const jsonData = { type: 'buttons', buttons: [{ text: 'B1' }] };
     const blockMatchInput: BlockMatch = {
      block: mockBlockDef, output: JSON.stringify(jsonData), isVisible: false,
      priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
    };
    component.blockMatch = blockMatchInput;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, blockMatchInput, true) });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.buttons-block')).toBeNull();
    expect(fixture.nativeElement.querySelector('.buttons-error')).toBeNull();
  });
});
