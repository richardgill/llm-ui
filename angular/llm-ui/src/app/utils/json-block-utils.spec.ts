import {
  JsonBlockOptions,
  JsonBlockOptionsComplete,
  getJsonBlockOptions,
  defaultJsonOptions,
  parseJson5,
  getJsonMatchers,
  getJsonLookBack,
  // Ensure other necessary helpers from json-block-utils like setJsonPath, traverseLeafNodes are also tested if complex,
  // but main focus here is on the exported high-level functions.
  // For brevity, jsonPath helpers tests might be skipped here but are important.
} from './json-block-utils';
import { LLMOutputMatcher, LookBackFunction, MaybeLLMOutputMatch } from '../models/llm-output-types';

describe('JsonBlockUtils', () => {
  describe('getJsonBlockOptions', () => {
    it('should return default options merged with user options', () => {
      const userOpts: JsonBlockOptions = { type: 'testJson' };
      const opts = getJsonBlockOptions(userOpts);
      expect(opts.type).toBe('testJson');
      expect(opts.startChar).toBe(defaultJsonOptions.startChar);
      expect(opts.endChar).toBe(defaultJsonOptions.endChar);
    });

    it('should override default options', () => {
      const userOpts: JsonBlockOptions = { type: 'testJson', startChar: '{', endChar: '}' };
      const opts = getJsonBlockOptions(userOpts);
      expect(opts.startChar).toBe('{');
      expect(opts.endChar).toBe('}');
    });

    it('should throw if type is not provided', () => {
      // @ts-ignore
      expect(() => getJsonBlockOptions({})).toThrowError('type option is required for JSON blocks');
    });
  });

  describe('parseJson5', () => {
    it('should parse valid JSON', () => {
      expect(parseJson5('{ "key": "value" }')).toEqual({ key: 'value' });
    });

    it('should parse JSON with comments (using jsonrepair)', () => {
      expect(parseJson5('// comment\n{ "key": "value" }')).toEqual({ key: 'value' });
    });

    it('should parse JSON with trailing commas (using jsonrepair)', () => {
      expect(parseJson5('{ "key": "value", }')).toEqual({ key: 'value' });
    });

    it('should return undefined for invalid JSON that cannot be repaired', () => {
      expect(parseJson5('{ "key": "value"')).toBeUndefined();
    });
  });

  describe('getJsonMatchers', () => {
    const testOptions: JsonBlockOptions = { type: 'customJson', startChar: 'JSON<', endChar: '>ENDJSON' };
    const { findCompleteMatch, findPartialMatch } = getJsonMatchers(testOptions);

    it('findCompleteMatch should identify a complete JSON block', () => {
      const text = 'Prefix JSON<{ "type": "customJson", "data": "test" }>ENDJSON Suffix';
      const match = findCompleteMatch(text);
      expect(match).toBeDefined();
      expect(match?.outputRaw).toBe('JSON<{ "type": "customJson", "data": "test" }>ENDJSON');
      expect(match?.startIndex).toBe(7);
      expect(match?.endIndex).toBe(text.length - 7);
    });

    it('findCompleteMatch should return undefined if type does not match', () => {
      const text = 'Prefix JSON<{ "type": "otherJson", "data": "test" }>ENDJSON Suffix';
      expect(findCompleteMatch(text)).toBeUndefined();
    });

    it('findPartialMatch should identify a partially formed JSON block from the start', () => {
      const text = 'Prefix JSON<{ "type": "customJson", "data": "te'; // This should match based on type if parseJson5 can handle it
      const match = findPartialMatch(text);
      // The current findJsonBlock for partial matches will try to parse the content.
      // If 'JSON<{ "type": "customJson", "data": "te' is fed to removeStartEndChars, it becomes '{ "type": "customJson", "data": "te'.
      // jsonrepair might fix this to '{ "type": "customJson", "data": "te"}' which is valid JSON.
      // So a match should be found.
      expect(match).toBeDefined();
      if (match) { // type guard
        expect(match.outputRaw).toBe('JSON<{ "type": "customJson", "data": "te');
      }
    });
    
    it('findCompleteMatch should handle multiple blocks and find the first valid one', () => {
      const text = 'JSON<{ "type": "wrongType" }>ENDJSON JSON<{ "type": "customJson", "val": 1 }>ENDJSON';
      const match = findCompleteMatch(text);
      expect(match).toBeDefined();
      expect(match?.outputRaw).toBe('JSON<{ "type": "customJson", "val": 1 }>ENDJSON');
    });

  });

  describe('getJsonLookBack', () => {
    const lookbackOptions: JsonBlockOptions = {
      type: 'dataJson',
      startChar: '<<',
      endChar: '>>',
      visibleKeyPaths: ['$.data.name', '$.data.value'], // Only these are visible
      typeKey: 'jsonType', // Custom type key
      defaultVisible: false, // Explicitly set for clarity in this test
    };
    const lookBackFn = getJsonLookBack(lookbackOptions);

    it('should process object and make only specified paths visible', () => {
      const rawMatchedOutput = '<<{ "jsonType": "dataJson", "data": { "name": "TestName", "value": 123, "secret": "hidden" }, "other": "notVisible" }>>';
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 20 });
      
      expect(result.visibleText).toBe('TestName123'); // "TestName" (8) + "123" (3) = 11 chars. Max 20.
      
      const outputObj = JSON.parse(result.output);
      expect(outputObj.data.name).toBe('TestName');
      expect(outputObj.data.value).toBe('123'); // Note: setJsonPath stringifies numbers/booleans
      expect(outputObj.data.secret).toBe('hidden'); // Still in output, just not in visibleText
      expect(outputObj.other).toBe('notVisible');
    });

    it('should truncate visible text according to visibleTextLengthTarget', () => {
      const rawMatchedOutput = '<<{ "jsonType": "dataJson", "data": { "name": "Longer Name", "value": 45678 } }>>';
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 10 });
      // "Longer Nam" (10 chars from "Longer Name")
      expect(result.visibleText).toBe('Longer Nam');

      const outputObj = JSON.parse(result.output);
      expect(outputObj.data.name).toBe('Longer Nam'); // Truncated in output object
      expect(outputObj.data.value).toBe('45678'); // Not reached for visibility target, so it's a string in output
    });

    it('should return empty strings if type does not match', () => {
      const rawMatchedOutput = '<<{ "jsonType": "wrongType", "data": "test" }>>';
      const result = lookBackFn({ output: rawMatchedOutput, isComplete: true, visibleTextLengthTarget: 10 });
      expect(result.output).toBe('');
      expect(result.visibleText).toBe('');
    });

    it('should show a space for visibleText if complete and nothing is visible but target > 0 (defaultVisible: false, no visibleKeyPaths)', () => {
      const opts: JsonBlockOptions = { type: 'emptyJson', defaultVisible: false, startChar: '{', endChar: '}' }; // No visibleKeyPaths
      const lbFn = getJsonLookBack(opts);
      // Ensure the raw output actually contains the type key, otherwise it's considered not matching.
      const raw = `{{ "type": "emptyJson" }}`; 
      const result = lbFn({ output: raw, isComplete: true, visibleTextLengthTarget: 10 });
      expect(result.visibleText).toBe(' ');
    });

    it('should handle defaultVisible: true correctly', () => {
        const optsDefaultTrue: JsonBlockOptions = {
            type: 'report',
            startChar: '<<',
            endChar: '>>',
            defaultVisible: true,
            invisibleKeyPaths: ['$.metadata', '$.config.settings.token'], // Hide these
            typeKey: 'reportType'
        };
        const lbFnDefaultTrue = getJsonLookBack(optsDefaultTrue);
        const rawOutput = '<<{ "reportType": "report", "title": "My Report", "data": { "value": 100, "isValid": true }, "metadata": { "id": "xyz" }, "config": { "settings": { "featureFlag": true, "token": "secret" } } }>>';
        const result = lbFnDefaultTrue({ output: rawOutput, isComplete: true, visibleTextLengthTarget: 100 });
        
        // Expected visible: "My Report100truefeatureFlag" (title, data.value, data.isValid, config.settings.featureFlag)
        // reportType, metadata, and config.settings.token should be hidden.
        expect(result.visibleText).toBe('My Report100truefeatureFlag');

        const outputObj = JSON.parse(result.output);
        expect(outputObj.title).toBe('My Report');
        expect(outputObj.data.value).toBe('100');
        expect(outputObj.data.isValid).toBe('true');
        expect(outputObj.config.settings.featureFlag).toBe('true');
        // Check that hidden fields are still in the output object but potentially modified by setJsonPath if they were part of visible paths before truncation (not the case here)
        expect(outputObj.metadata.id).toBe('xyz'); 
        expect(outputObj.config.settings.token).toBe('secret');
    });

  });
});
