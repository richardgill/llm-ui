import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CsvButtonsComponent } from './csv-buttons-block.component';
import { BlockMatch, LLMOutputFallbackBlock } from '../../models/llm-output-types'; // CsvBlockOptions removed as it's part of LLMOutputFallbackBlock for mock
import { Type, SimpleChange } from '@angular/core'; // Added SimpleChange
import { CsvBlockOptions } from '../../utils/csv-block-utils'; // Import CsvBlockOptions

describe('CsvButtonsComponent', () => {
  let component: CsvButtonsComponent;
  let fixture: ComponentFixture<CsvButtonsComponent>;
  const mockBlockDef: LLMOutputFallbackBlock = { component: null as any, lookBack: jest.fn() };
  
  // Define options that match what CsvButtonsComponent expects or defaults to.
  // The component's getEffectiveOptions uses { type: 'buttons', ...defaultCsvOptions } if options input is undefined.
  const defaultTestOptions: CsvBlockOptions = { type: 'buttons' }; // Relying on defaultCsvOptions for start/end/delimiter

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsvButtonsComponent] // Standalone
    })
    .compileComponents();

    fixture = TestBed.createComponent(CsvButtonsComponent);
    component = fixture.componentInstance;
    // component.options = defaultTestOptions; // Set default options for tests, or test with undefined and rely on getEffectiveOptions
                                           // If relying on getEffectiveOptions, ensure its default matches test cases.
                                           // For these tests, we'll set it to ensure consistency.
    component.options = { type: 'buttons', startChar: '⦅', endChar: '⦆', delimiter: ',' }; // Explicitly match example data
  });

  it('should create', () => {
    fixture.detectChanges(); // Trigger ngOnChanges if blockMatch is set initially
    expect(component).toBeTruthy();
  });

  it('should parse valid CSV-like output and display buttons', () => {
    const blockMatchInput: BlockMatch = {
      block: mockBlockDef, output: '⦅buttons,B1,B2,B3⦆', isVisible: true,
      priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
    };
    component.blockMatch = blockMatchInput;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, blockMatchInput, true) });
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent.trim()).toBe('B1');
    expect(buttons[2].textContent.trim()).toBe('B3');
    expect(component.parseError).toBeNull();
  });

  it('should display error if content parsing results in no buttons', () => {
    const blockMatchNoData: BlockMatch = {
      block: mockBlockDef, output: '⦅buttons,⦆', isVisible: true, // Results in empty content after prefix/suffix removal
      priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
    };
    component.blockMatch = blockMatchNoData;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, blockMatchNoData, true) });
    fixture.detectChanges();
    expect(component.parseError).toBe("No button data found in CSV content.");
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('should correctly parse with different delimiter specified in options', () => {
    component.options = { type: 'buttons', delimiter: ';', startChar: '[[', endChar: ']]' };
    const blockMatchInput: BlockMatch = {
      block: mockBlockDef, output: '[[buttons;Btn1;Btn2]]', isVisible: true,
      priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
    };
    component.blockMatch = blockMatchInput;
    component.ngOnChanges({ 
        blockMatch: new SimpleChange(null, blockMatchInput, true),
        options: new SimpleChange(null, component.options, true) 
    });
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent.trim()).toBe('Btn1');
    expect(component.parseError).toBeNull();
  });

  it('should not render if not visible', () => {
    const blockMatchInput: BlockMatch = {
     block: mockBlockDef, output: '⦅buttons,B1⦆', isVisible: false,
     priority:0, llmOutput:"", isComplete:true, startIndex:0, endIndex:0, outputRaw:"",
   };
   component.blockMatch = blockMatchInput;
   component.ngOnChanges({ blockMatch: new SimpleChange(null, blockMatchInput, true) });
   fixture.detectChanges();
   expect(fixture.nativeElement.querySelector('.csv-buttons-block')).toBeNull();
   expect(fixture.nativeElement.querySelector('.csv-buttons-error')).toBeNull();
 });
});
