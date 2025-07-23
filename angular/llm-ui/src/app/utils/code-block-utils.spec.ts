import {
  CodeBlockOptions,
  // CodeBlockData, // Already imported where parseCodeBlock is defined
  getCodeBlockOptions,
  defaultCodeBlockOptions,
  parseCodeBlock,
  getCodeBlockMatchers,
  getCodeBlockLookBack,
} from './code-block-utils';
import { LLMOutputMatcher, LookBackFunction, MaybeLLMOutputMatch } from '../models/llm-output-types';

describe('CodeBlockUtils', () => {
  describe('getCodeBlockOptions', () => {
    it('should return default options if no user options are provided', () => {
      const opts = getCodeBlockOptions();
      expect(opts).toEqual(defaultCodeBlockOptions);
    });

    it('should merge user options with default options', () => {
      const userOpts: Partial<CodeBlockOptions> = { startEndChars: ['```'] };
      const opts = getCodeBlockOptions(userOpts);
      expect(opts.startEndChars).toEqual(['```']);
    });
  });

  describe('parseCodeBlock (refined)', () => {
    it('should parse a complete block with language', () => {
      const md = '```javascript\nconsole.log("hello");\n```';
      const result = parseCodeBlock(md, undefined, true);
      expect(result.language).toBe('javascript');
      expect(result.code).toBe('console.log("hello");');
      expect(result.metaString).toBeUndefined();
    });

    it('should parse a complete block with language and meta', () => {
      const md = '```python my_script.py --arg\nprint("OK")\n```';
      const result = parseCodeBlock(md, undefined, true);
      expect(result.language).toBe('python');
      expect(result.metaString).toBe('my_script.py --arg');
      expect(result.code).toBe('print("OK")');
    });
    
    it('should parse a complete block with no language', () => {
      const md = '```\nraw text\n```';
      const result = parseCodeBlock(md, undefined, true);
      expect(result.language).toBeUndefined();
      expect(result.code).toBe('raw text');
    });

    it('should parse a partial block with language and partial code', () => {
      const md = '```javascript\nconsole.log("hel'; // No closing fence
      const result = parseCodeBlock(md, undefined, false);
      expect(result.language).toBe('javascript');
      expect(result.code).toBe('console.log("hel');
    });
    
    it('should parse a partial block with only language', () => {
      const md = '```javascript'; 
      const result = parseCodeBlock(md, undefined, false);
      expect(result.language).toBe('javascript');
      expect(result.code).toBe(''); // No code content after first line yet
    });

     it('should handle content not starting with fence as raw code', () => {
      const md = 'Just some text';
      const result = parseCodeBlock(md); // isComplete defaults to true
      expect(result.code).toBe('Just some text');
      expect(result.language).toBeUndefined();
    });

    it('should parse a complete block without newline before closing fence', () => {
        const md = '```javascript\nconsole.log("hello");```';
        const result = parseCodeBlock(md, undefined, true);
        expect(result.language).toBe('javascript');
        expect(result.code).toBe('console.log("hello");');
        expect(result.metaString).toBeUndefined();
    });
  });

  describe('getCodeBlockMatchers', () => {
    const { findCompleteMatch, findPartialMatch } = getCodeBlockMatchers(); // Use default options (```)

    it('findCompleteMatch should identify a complete code block', () => {
      const text = 'Prefix ```python\nprint("Hello")\n``` Suffix';
      const match = findCompleteMatch(text);
      expect(match).toBeDefined();
      expect(match?.outputRaw).toBe('```python\nprint("Hello")\n```');
      expect(match?.startIndex).toBe(7);
    });

    it('findCompleteMatch should return undefined for incomplete blocks (missing final fence newline)', () => {
      // Current completeRegex `^${escapedFence}(\S*\s*[^\n]*)\n([\s\S]*?)(?<=\n)${escapedFence}$`
      // requires a newline before the final fence.
      const text = 'Prefix ```python\nprint("Hello")``` Suffix'; 
      expect(findCompleteMatch(text)).toBeUndefined();
    });
    
    it('findCompleteMatch should match block with no language', () => {
      const text = '```\nTest\n```';
      const match = findCompleteMatch(text);
      expect(match).toBeDefined();
      expect(match?.outputRaw).toBe('```\nTest\n```');
    });

    it('findPartialMatch should identify a block with opening fence and language', () => {
      const text = 'Prefix ```javascript';
      const match = findPartialMatch(text);
      expect(match).toBeDefined();
      expect(match?.outputRaw).toBe('```javascript');
    });
    
    it('findPartialMatch should identify a block with opening fence, language, and some code', () => {
      const text = 'Prefix ```javascript\nconsole.log("h");';
      const match = findPartialMatch(text);
      expect(match).toBeDefined();
      expect(match?.outputRaw).toBe('```javascript\nconsole.log("h");');
    });
  });

  describe('getCodeBlockLookBack', () => {
    const lookBackFn = getCodeBlockLookBack(); // Default options

    it('should process a complete code block, returning full code for output and visibleText (if target allows)', () => {
      const rawMatchedOutput = '```python\nprint("Full code")\n```';
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 100 });
      
      expect(result.visibleText).toBe('print("Full code")');
      expect(result.output).toBe('```python\nprint("Full code")\n```');
    });

    it('should truncate visibleText for a complete code block', () => {
      const rawMatchedOutput = '```python\nprint("This is long code")\n```'; // code length 23
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 10 });
      
      expect(result.visibleText).toBe('print("Th'); 
      expect(result.output).toBe('```python\nprint("Th\n```');
    });

    it('should process a partial code block (no closing fence in output if not complete)', () => {
      const rawMatchedOutput = '```javascript\nlet x = 1;'; 
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: false, visibleTextLengthTarget: 100 });
      
      expect(result.visibleText).toBe('let x = 1;');
      expect(result.output).toBe('```javascript\nlet x = 1;'); 
    }});

    it('should add closing fence to output if isComplete is true, even if rawMatchedOutput is partial but implies completion by content', () => {
      const rawMatchedOutput = '```python\nprint("Done")'; 
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 100 });
      
      expect(result.visibleText).toBe('print("Done")');
      expect(result.output).toBe('```python\nprint("Done")\n```'); 
    });
    
    it('should handle block with language and meta string correctly in output', () => {
      const rawMatchedOutput = '```python file.py --exec\nprint("meta")\n```';
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 100 });
      expect(result.visibleText).toBe('print("meta")');
      expect(result.output).toBe('```python file.py --exec\nprint("meta")\n```');
    });

    it('should handle block with no language in output', () => {
      const rawMatchedOutput = '```\nNo language here\n```';
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 100 });
      expect(result.visibleText).toBe('No language here');
      expect(result.output).toBe('```\nNo language here\n```');
    });

    it('should correctly reconstruct output for partial match that has full code content but no closing fence in raw', () => {
        const rawMatchedOutput = '```python\nprint("Partial but all here")'; // No closing fence in raw
        // If isComplete is false, it means the stream *might* continue for this block OR for a new block.
        // The lookback's job is to represent the *current state* of this block.
        const result = lookBackFn({ output: rawMatchedOutput, isComplete: false, visibleTextLengthTarget: 100 });
        expect(result.visibleText).toBe('print("Partial but all here")');
        // Since isComplete is false, we don't add the closing fence.
        expect(result.output).toBe('```python\nprint("Partial but all here")');
    });
    
    it('should handle empty code block', () => {
        const rawMatchedOutput = '```python\n```';
        const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 100 });
        expect(result.visibleText).toBe('');
        expect(result.output).toBe('```python\n\n```'); // parseCodeBlock results in code: "", lookback adds newline
    });

    it('should handle code block with only language line', () => {
        const rawMatchedOutput = '```python';
        const result = lookBackFn({ output: rawMatchedOutput, isComplete: false, visibleTextLengthTarget: 100 });
        expect(result.visibleText).toBe('');
        expect(result.output).toBe('```python\n'); // parseCodeBlock gives code: "", lookback adds newline
    });


  });
});
