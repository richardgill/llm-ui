import {
  CsvBlockOptions,
  CsvBlockOptionsComplete,
  getCsvBlockOptions,
  defaultCsvOptions,
  parseCsv,
  getCsvMatchers,
  getCsvLookBack,
} from './csv-block-utils';
import { LLMOutputMatcher, LookBackFunction, MaybeLLMOutputMatch } from '../models/llm-output-types';

describe('CsvBlockUtils', () => {
  describe('getCsvBlockOptions', () => {
    it('should return default options merged with user options', () => {
      const userOpts: CsvBlockOptions = { type: 'testCsv' };
      const opts = getCsvBlockOptions(userOpts);
      expect(opts.type).toBe('testCsv');
      expect(opts.startChar).toBe(defaultCsvOptions.startChar);
      expect(opts.endChar).toBe(defaultCsvOptions.endChar);
      expect(opts.delimiter).toBe(defaultCsvOptions.delimiter);
      expect(opts.allIndexesVisible).toBe(defaultCsvOptions.allIndexesVisible);
      expect(opts.visibleIndexes).toEqual(defaultCsvOptions.visibleIndexes);
    });

    it('should throw if type is not provided', () => {
      // @ts-ignore
      expect(() => getCsvBlockOptions({})).toThrowError('type option is required for CSV blocks');
    });

    it('should throw if allIndexesVisible is true and visibleIndexes is not empty', () => {
      const userOpts: CsvBlockOptions = { type: 'testCsv', allIndexesVisible: true, visibleIndexes: [1] };
      expect(() => getCsvBlockOptions(userOpts))
        .toThrowError("visibleIndexes should be [] when allIndexesVisible is true");
    });
  });

  describe('parseCsv', () => {
    const options: CsvBlockOptionsComplete = { ...defaultCsvOptions, type: 'test' };
    it('should parse a simple CSV string', () => {
      expect(parseCsv('val1,val2,val3', options)).toEqual(['val1', 'val2', 'val3']);
    });

    it('should filter out empty items', () => {
      expect(parseCsv('val1,,val2,', options)).toEqual(['val1', 'val2']);
    });

    it('should return empty array for empty or undefined input', () => {
      expect(parseCsv('', options)).toEqual([]);
      expect(parseCsv(undefined as any, options)).toEqual([]);
    });
  });

  describe('getCsvMatchers', () => {
    const testOptions: CsvBlockOptions = {
      type: 'data_csv',
      startChar: '[CSV:',
      endChar: ']',
      delimiter: '|'
    };
    const { findCompleteMatch, findPartialMatch } = getCsvMatchers(testOptions);

    it('findCompleteMatch should identify a complete CSV block', () => {
      const text = 'Prefix [CSV:data_csv|field1|field2|field3] Suffix';
      const match = findCompleteMatch(text);
      expect(match).toBeDefined();
      expect(match?.outputRaw).toBe('[CSV:data_csv|field1|field2|field3]');
      expect(match?.startIndex).toBe(7);
    });

    it('findCompleteMatch should return undefined if type does not match', () => {
      const text = 'Prefix [CSV:other_csv|field1] Suffix';
      expect(findCompleteMatch(text)).toBeUndefined();
    });
    
    it('findPartialMatch should identify a partial CSV block', () => {
        const text = 'Prefix [CSV:data_csv|field1|fi';
        const match = findPartialMatch(text);
        expect(match).toBeDefined();
        expect(match?.outputRaw).toBe('[CSV:data_csv|field1|fi');
    });
  });

  describe('getCsvLookBack', () => {
    const defaultLookbackOptions: CsvBlockOptions = { type: 'log_data', delimiter: ';' }; // Uses default start/end chars ⦅ ⦆
    const lookBackFn = getCsvLookBack(defaultLookbackOptions);

    it('should process basic CSV and make all items visible by default', () => {
      const rawMatchedOutput = '⦅log_data;event1;dataA;val1⦆';
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 30 });
      // visibleText = "event1dataAval1" (concatenated without delimiter)
      // output = "⦅log_data;event1;dataA;val1⦆" (reconstructed)
      expect(result.visibleText).toBe('event1dataAval1');
      expect(result.output).toBe(rawMatchedOutput);
    });

    it('should truncate visible text based on visibleTextLengthTarget', () => {
      const rawMatchedOutput = '⦅log_data;longeventname;moredetails;finalpart⦆'; // len: 13, 11, 9
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 20 });
      // "longeventnamemoredeta" (longeventname (13) + moredetails (11) -> moredeta (7) = 20)
      expect(result.visibleText).toBe('longeventnamemoredeta');
      // output should have truncated parts for visible items
      // "⦅log_data;longeventname;moredeta;finalpart⦆" (original has "moredetails")
      expect(result.output).toBe('⦅log_data;longeventname;moredeta;finalpart⦆');
    });

    it('should handle specific visibleIndexes', () => {
      const opts: CsvBlockOptions = { type: 'report', delimiter: ',', allIndexesVisible: false, visibleIndexes: [1, 3] }; // Show 2nd and 4th data items
      const lbFn = getCsvLookBack(opts);
      const raw = `${defaultCsvOptions.startChar}report,col0,col1_visible,col2_hidden,col3_visible${defaultCsvOptions.endChar}`;
      const result = lbFn({ output: raw, isComplete: true, visibleTextLengthTarget: 100 });
      expect(result.visibleText).toBe('col1_visiblecol3_visible');
      expect(result.output).toBe(`${defaultCsvOptions.startChar}report,col0,col1_visible,col2_hidden,col3_visible${defaultCsvOptions.endChar}`);
    });
    
    it('should show space for visibleText if complete, nothing visible, and target > 0', () => {
        const opts: CsvBlockOptions = { type: 'novis', allIndexesVisible: false, visibleIndexes: [] };
        const lbFn = getCsvLookBack(opts);
        const raw = `${defaultCsvOptions.startChar}novis,data1,data2${defaultCsvOptions.endChar}`;
        const result = lbFn({ output: raw, isComplete: true, visibleTextLengthTarget: 10 });
        expect(result.visibleText).toBe(' ');
    });

    it('should handle partial output correctly (not adding endChar)', () => {
        const rawMatchedOutput = '⦅log_data;event1;dataA'; // No end char
        const result = lookBackFn({ output: rawMatchedOutput, isComplete: false, visibleTextLengthTarget: 30 });
        expect(result.visibleText).toBe('event1dataA');
        expect(result.output).toBe('⦅log_data;event1;dataA'); // No end char added
    });
  }});
});
