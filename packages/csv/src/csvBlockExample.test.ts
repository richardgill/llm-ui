import { describe, expect, it } from "vitest";
import { csvBlockExample } from "./csvBlockExample";
import { CsvBlockOptions } from "./options";

type TestCase = {
  name: string;
  example: string[];
  options: CsvBlockOptions;
  expected: string;
};

describe("csvBlockExample", () => {
  const testCases: TestCase[] = [
    {
      name: "single",
      example: ["abc"],
      options: { type: "t" },
      expected: "⦅abc⦆",
    },
    {
      name: "multiple",
      example: ["abc", "def"],
      options: { type: "t" },
      expected: "⦅abc,def⦆",
    },
    {
      name: "custom delimiter",
      example: ["abc", "def"],
      options: { type: "t", delimiter: ";" },
      expected: "⦅abc;def⦆",
    },
    {
      name: "custom start and end chars",
      example: ["abc", "def"],
      options: { type: "t", startChar: "x", endChar: "y" },
      expected: "xabc,defy",
    },
  ];

  testCases.forEach(({ name, example, options, expected }) => {
    it(name, () => {
      expect(csvBlockExample(example, options)).toEqual(expected);
    });
  });
});
