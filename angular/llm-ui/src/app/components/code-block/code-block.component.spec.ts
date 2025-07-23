import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { CodeBlockComponent } from './code-block.component';
import { BlockMatch, LLMOutputFallbackBlock } from '../../models/llm-output-types';
import { Type, SimpleChange, SecurityContext, Component } from '@angular/core'; // Added Component for mock BlockMatch
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ShikiService } from '../../services/shiki.service';
import { HighlighterCore } from 'shiki/core';
// Removed 'rxjs' import as it's not directly used for Promise control here.

// Mock parseCodeBlock from utils
// jest.mock is a Jest specific API. For Angular tests (Karma/Jasmine), we use spies.
import * as CodeBlockUtils from '../../utils/code-block-utils';
import { CodeBlockData } from '../../utils/code-block-utils'; // Import the type

// Mock Shiki Highlighter
const mockShikiHighlighterInstance: Partial<HighlighterCore> = {
  codeToHtml: jest.fn((code, options) => `<pre class="shiki-mock">${code}</pre>`),
  getLoadedLanguages: jest.fn(() => ['javascript', 'python', 'plaintext'] as any),
};

describe('CodeBlockComponent', () => {
  let component: CodeBlockComponent;
  let fixture: ComponentFixture<CodeBlockComponent>;
  let sanitizer: DomSanitizer;
  let mockShikiService: ShikiService; // Use the actual service type for better mocking if methods are complex
  let getHighlighterPromise: Promise<HighlighterCore>;
  let getHighlighterPromiseResolve: (value: HighlighterCore) => void;
  let getHighlighterPromiseReject: (reason?: any) => void;
  let parseCodeBlockSpy: jasmine.Spy;


  const mockBlockDefinition: LLMOutputFallbackBlock = { component: Component as Type<any>, lookBack: jest.fn() };
  const initialParsedCode: CodeBlockData = { code: 'console.log("Initial");', language: 'javascript', metaString: '' };

  beforeEach(async () => {
    parseCodeBlockSpy = spyOn(CodeBlockUtils, 'parseCodeBlock').and.returnValue(initialParsedCode);
    
    getHighlighterPromise = new Promise((resolve, reject) => {
        getHighlighterPromiseResolve = resolve;
        getHighlighterPromiseReject = reject;
    });

    // Using a real instance of ShikiService but spying on its methods
    // Or, provide a complete mock object. Let's spy for this case.
    // Or, more simply, provide a mock object as initially intended.
    const shikiServiceMockObject = {
      getHighlighter: jest.fn(() => getHighlighterPromise),
      getHighlighterSync: jest.fn(() => undefined), 
    };


    await TestBed.configureTestingModule({
      imports: [CommonModule, CodeBlockComponent],
      providers: [
        { provide: ShikiService, useValue: shikiServiceMockObject },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CodeBlockComponent);
    component = fixture.componentInstance;
    sanitizer = TestBed.inject(DomSanitizer);
    mockShikiService = TestBed.inject(ShikiService); // Get the mocked instance

    // Default input needed for ngOnInit/OnChanges
    component.blockMatch = { 
        block: mockBlockDefinition, 
        output: '', 
        isVisible: true, priority: 0, llmOutput: "", isComplete: true, startIndex: 0, endIndex: 0, outputRaw: ""
    }; 
  });

  afterEach(() => {
    // Restore spies if they were on global objects or if using Jest's spy system extensively
    // For Jasmine spies on service methods, TestBed usually handles teardown.
    // jest.restoreAllMocks(); // If using Jest spies
  });

  it('should create', () => {
    fixture.detectChanges(); // Trigger ngOnInit
    expect(component).toBeTruthy();
  });

  it('should call parseCodeBlock and attempt to highlight on ngOnChanges', fakeAsync(() => {
    const newCode = 'let x = 10;';
    const newLang = 'typescript';
    parseCodeBlockSpy.and.returnValue({ code: newCode, language: newLang });
    
    const mockMatch: BlockMatch = {
        block: mockBlockDefinition, output: `\`\`\`${newLang}\n${newCode}\n\`\`\``,
        isVisible: true, priority: 0, llmOutput: "", isComplete: true, startIndex: 0, endIndex: 0, outputRaw: "",
    };
    
    fixture.detectChanges(); // ngOnInit
    component.blockMatch = mockMatch;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, mockMatch, true) });
    fixture.detectChanges(); // ngOnChanges updates

    expect(parseCodeBlockSpy).toHaveBeenCalledWith(mockMatch.output);
    expect(component.rawCode).toBe(newCode);

    (mockShikiHighlighterInstance.codeToHtml as jest.Mock).mockClear(); 
    getHighlighterPromiseResolve(mockShikiHighlighterInstance as HighlighterCore);
    tick(); 
    fixture.detectChanges();

    expect(mockShikiHighlighterInstance.codeToHtml).toHaveBeenCalledWith(newCode, { lang: newLang });
    expect(component.highlightedHtml).toEqual(sanitizer.bypassSecurityTrustHtml(`<pre class="shiki-mock">${newCode}</pre>`));
  }));
  
  it('should use fallback highlighting if Shiki service fails to load highlighter', fakeAsync(() => {
    const code = 'fallback code';
    parseCodeBlockSpy.and.returnValue({ code: code, language: 'unknown' });
    const mockMatch: BlockMatch = { block: mockBlockDefinition, output: code, isVisible: true, priority:0,llmOutput:"",isComplete:true,startIndex:0,endIndex:0,outputRaw:"" };

    fixture.detectChanges(); // ngOnInit
    component.blockMatch = mockMatch;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, mockMatch, true) });
    
    getHighlighterPromiseReject("Shiki load error");
    tick(); 
    fixture.detectChanges();

    expect(component.highlightedHtml).toEqual(sanitizer.sanitize(SecurityContext.HTML, code));
  }));
  
  it('should use specified language or fallback to plaintext if language not loaded/specified in Shiki', fakeAsync(() => {
    const code = 'custom lang code';
    parseCodeBlockSpy.and.returnValue({ code: code, language: 'myCustomLang' }); 
    const mockMatch: BlockMatch = { block: mockBlockDefinition, output: code, isVisible: true, priority:0,llmOutput:"",isComplete:true,startIndex:0,endIndex:0,outputRaw:"" };

    fixture.detectChanges(); // ngOnInit
    component.blockMatch = mockMatch;
    component.ngOnChanges({ blockMatch: new SimpleChange(null, mockMatch, true) });

    (mockShikiHighlighterInstance.codeToHtml as jest.Mock).mockClear();
    getHighlighterPromiseResolve(mockShikiHighlighterInstance as HighlighterCore);
    tick();
    fixture.detectChanges();

    expect(mockShikiHighlighterInstance.codeToHtml).toHaveBeenCalledWith(code, { lang: 'plaintext' });
  }));


  it('should initially use fallback if highlighter is not ready, then highlight when ready', fakeAsync(() => {
    const code = 'console.log("async test");';
    const lang = 'javascript';
    parseCodeBlockSpy.and.returnValue({ code: code, language: lang });
    const mockMatch: BlockMatch = { block: mockBlockDefinition, output: `\`\`\`${lang}\n${code}\n\`\`\``, isVisible: true, priority:0,llmOutput:"",isComplete:true,startIndex:0,endIndex:0,outputRaw:"" };
    
    component.blockMatch = mockMatch; // Set input before ngOnInit is explicitly called by detectChanges
    fixture.detectChanges(); // ngOnInit -> ShikiService.getHighlighter called, promise pending
                             // ngOnChanges also called due to first change of blockMatch
    
    // Fallback should be used initially because highlighter is not resolved yet
    expect(component.highlightedHtml).toEqual(sanitizer.sanitize(SecurityContext.HTML, code)); 

    (mockShikiHighlighterInstance.codeToHtml as jest.Mock).mockClear();
    getHighlighterPromiseResolve(mockShikiHighlighterInstance as HighlighterCore);
    tick(); 
    fixture.detectChanges();

    expect(mockShikiHighlighterInstance.codeToHtml).toHaveBeenCalledWith(code, { lang: lang });
    expect(component.highlightedHtml).toEqual(sanitizer.bypassSecurityTrustHtml(`<pre class="shiki-mock">${code}</pre>`));
  }));

});
