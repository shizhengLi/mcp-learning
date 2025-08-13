import { describe, it, expect, beforeEach } from '@jest/globals';
import { JavaScriptAnalyzer } from '../analysis/JavaScriptAnalyzer';
import { AnalysisIssue, RefactoringSuggestion } from '../analysis/BaseCodeAnalyzer';

describe('JavaScriptAnalyzer', () => {
  let analyzer: JavaScriptAnalyzer;

  beforeEach(async () => {
    analyzer = new JavaScriptAnalyzer({
      includeSuggestions: true,
      thresholds: {
        complexity: 10,
        maintainability: 70,
      },
    });
    await analyzer.initialize();
    
    // Mock readFile method for testing
    (analyzer as any).readFile = jest.fn().mockImplementation(async (_filePath: string) => {
      return 'function test() {\n  return "test";\n}';
    });
  });

  describe('Initialization', () => {
    it('should register JavaScript language support', () => {
      const languages = analyzer.getSupportedLanguages();
      expect(languages).toContain('javascript');
      expect(analyzer.isLanguageSupported('javascript')).toBe(true);
    });

    it('should detect JavaScript files by extension', () => {
      expect(analyzer.isLanguageSupported('javascript')).toBe(true);
      expect(analyzer['detectLanguage']('test.js')).toBeTruthy();
      expect(analyzer['detectLanguage']('test.jsx')).toBeTruthy();
      expect(analyzer['detectLanguage']('test.ts')).toBeTruthy();
      expect(analyzer['detectLanguage']('test.tsx')).toBeTruthy();
      expect(analyzer['detectLanguage']('test.unknown')).toBeNull();
    });
  });

  describe('JavaScript Complexity Calculation', () => {
    it('should calculate basic complexity', () => {
      const simpleCode = 'function hello() {\n  return "Hello, World!";\n}';
      const complexity = (analyzer as any).calculateJavaScriptComplexity(simpleCode);
      expect(complexity).toBe(1);
    });

    it('should increase complexity for control structures', () => {
      const complexCode = `function complexFunction(items) {
  if (condition) {
    for (let item of items) {
      if (item.valid) {
        return item;
      } else if (item.invalid) {
        continue;
      }
    }
  }
  try {
    return result;
  } catch (error) {
    console.error(error);
  }
}`;
      
      const complexity = (analyzer as any).calculateJavaScriptComplexity(complexCode);
      expect(complexity).toBeGreaterThan(5);
    });

    it('should handle async/await complexity', () => {
      const asyncCode = `async function fetchData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data;
}`;
      
      const complexity = (analyzer as any).calculateJavaScriptComplexity(asyncCode);
      expect(complexity).toBeGreaterThan(1);
    });

    it('should handle empty code', () => {
      const complexity = (analyzer as any).calculateJavaScriptComplexity('');
      expect(complexity).toBe(1);
    });
  });

  describe('JavaScript Metrics Calculation', () => {
    it('should calculate basic metrics', () => {
      const code = `// This is a test function
function testFunction() {
  // Test function comment
  return "test";
}

class TestClass {
  method() {
    pass;
  }
}`;

      const complexity = 2;
      const metrics = (analyzer as any).calculateJavaScriptMetrics(code, complexity);

      expect(metrics.linesOfCode).toBeGreaterThan(0);
      expect(metrics.commentLines).toBe(2);
      expect(metrics.functionCount).toBeGreaterThan(0);
      expect(metrics.maintainability).toBeGreaterThan(0);
      expect(metrics.maintainability).toBeLessThanOrEqual(100);
    });

    it('should extract JavaScript dependencies', () => {
      const code = `import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
const lodash = require('lodash');`;

      const dependencies = (analyzer as any).extractJavaScriptDependencies(code);
      expect(dependencies).toContain('react');
      expect(dependencies).toContain('axios');
      expect(dependencies).toContain('lodash');
    });

    it('should handle code with no dependencies', () => {
      const code = `function hello() {
  console.log("Hello, World!");
}`;

      const dependencies = (analyzer as any).extractJavaScriptDependencies(code);
      expect(dependencies).toEqual([]);
    });

    it('should ignore local imports', () => {
      const code = `import { utils } from './utils';
import { config } from '../config';
import { helper } from '/helpers/helper';`;

      const dependencies = (analyzer as any).extractJavaScriptDependencies(code);
      expect(dependencies).toEqual([]);
    });
  });

  describe('JavaScript Style Checking', () => {
    it('should detect long lines', () => {
      const longLine = 'x'.repeat(150);
      const issues = (analyzer as any).checkJavaScriptStyle(longLine, [longLine]);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((issue: AnalysisIssue) => issue.message.includes('Line too long'))).toBe(true);
    });

    it('should detect missing semicolons', () => {
      const code = 'const x = 5\nconst y = 10';
      const lines = code.split('\n');
      const issues = (analyzer as any).checkJavaScriptStyle(code, lines);

      expect(issues.some((issue: AnalysisIssue) => issue.message.includes('Missing semicolon'))).toBe(true);
    });

    it('should detect var usage', () => {
      const code = 'var x = 5';
      const lines = code.split('\n');
      const issues = (analyzer as any).checkJavaScriptStyle(code, lines);

      expect(issues.some((issue: AnalysisIssue) => issue.message.includes('let or const instead of var'))).toBe(true);
    });

    it('should detect double equals', () => {
      const code = 'if (x == 5) { return true; }';
      const lines = code.split('\n');
      const issues = (analyzer as any).checkJavaScriptStyle(code, lines);

      expect(issues.some((issue: AnalysisIssue) => issue.message.includes('=== instead of =='))).toBe(true);
    });

    it('should pass valid style', () => {
      const code = `function testFunction() {
  const x = 5;
  const y = 10;
  if (x === 5) {
    return true;
  }
  return false;
}`;

      const lines = code.split('\n');
      const issues = (analyzer as any).checkJavaScriptStyle(code, lines);

      expect(issues.length).toBe(0);
    });
  });

  describe('JavaScript Best Practices Checking', () => {
    it('should detect console statements', () => {
      const code = 'function process() {\n  console.log("Debug info");\n  return processed;\n}';
      const lines = code.split('\n');
      const issues = (analyzer as any).checkJavaScriptBestPractices(code, lines);

      expect(issues.some((issue: AnalysisIssue) => issue.message.includes('Console statement'))).toBe(true);
    });

    it('should detect eval usage', () => {
      const code = 'const result = eval("2 + 2");';
      const lines = code.split('\n');
      const issues = (analyzer as any).checkJavaScriptBestPractices(code, lines);

      expect(issues.some((issue: AnalysisIssue) => issue.message.includes('eval() usage is dangerous'))).toBe(true);
      expect(issues[0].severity).toBe('high');
    });

    it('should detect nested ternary operators', () => {
      const code = 'const result = condition1 ? value1 : condition2 ? value2 : value3;';
      const lines = code.split('\n');
      const issues = (analyzer as any).checkJavaScriptBestPractices(code, lines);

      expect(issues.some((issue: AnalysisIssue) => issue.message.includes('Nested ternary operators'))).toBe(true);
    });

    it('should handle valid best practices', () => {
      const code = `function validFunction() {
  const x = 5;
  const y = 10;
  return x + y;
}`;

      const lines = code.split('\n');
      const issues = (analyzer as any).checkJavaScriptBestPractices(code, lines);

      expect(issues.length).toBe(0);
    });
  });

  describe('JavaScript Suggestions Generation', () => {
    it('should suggest async/await for Promise chains', () => {
      const code = `fetchData()
  .then(response => response.json())
  .then(data => processData(data))
  .catch(error => handleError(error));`;

      const lines = code.split('\n');
      const metrics = { complexity: 2, maintainability: 70, linesOfCode: 4, commentLines: 0, commentPercentage: 0, functionCount: 1, averageFunctionLength: 4, dependencies: [], technicalDebt: 0 };
      const suggestions = (analyzer as any).generateJavaScriptSuggestions(code, lines, metrics);

      // The analyzer should find multiple .then() calls and suggest async/await
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s: RefactoringSuggestion) => s.description.includes('async/await'))).toBe(true);
    });

    it('should suggest template literals for string concatenation', () => {
      const code = `const message = "Hello, " + name + "! Today is " + day + ".";`;

      const lines = code.split('\n');
      const metrics = { complexity: 1, maintainability: 80, linesOfCode: 1, commentLines: 0, commentPercentage: 0, functionCount: 0, averageFunctionLength: 0, dependencies: [], technicalDebt: 0 };
      const suggestions = (analyzer as any).generateJavaScriptSuggestions(code, lines, metrics);

      expect(suggestions.some((s: RefactoringSuggestion) => s.description.includes('template literals'))).toBe(true);
    });

    it('should suggest arrow functions for function keywords', () => {
      const code = `const items = [1, 2, 3].map(function(item) {
  return item * 2;
});`;

      const lines = code.split('\n');
      const metrics = { complexity: 1, maintainability: 75, linesOfCode: 3, commentLines: 0, commentPercentage: 0, functionCount: 1, averageFunctionLength: 3, dependencies: [], technicalDebt: 0 };
      const suggestions = (analyzer as any).generateJavaScriptSuggestions(code, lines, metrics);

      expect(suggestions.some((s: RefactoringSuggestion) => s.description.includes('arrow functions'))).toBe(true);
    });

    it('should suggest array methods for loops', () => {
      const code = `const result = [];
for (let i = 0; i < items.length; i++) {
  result.push(items[i] * 2);
}`;

      const lines = code.split('\n');
      const metrics = { complexity: 2, maintainability: 70, linesOfCode: 3, commentLines: 0, commentPercentage: 0, functionCount: 1, averageFunctionLength: 3, dependencies: [], technicalDebt: 0 };
      const suggestions = (analyzer as any).generateJavaScriptSuggestions(code, lines, metrics);

      expect(suggestions.some((s: RefactoringSuggestion) => s.description.includes('array methods'))).toBe(true);
    });

    it('should suggest destructuring for object property access', () => {
      const code = `const name = user.name;
const age = user.age;
const email = user.email;`;

      const lines = code.split('\n');
      const metrics = { complexity: 1, maintainability: 75, linesOfCode: 3, commentLines: 0, commentPercentage: 0, functionCount: 0, averageFunctionLength: 0, dependencies: [], technicalDebt: 0 };
      const suggestions = (analyzer as any).generateJavaScriptSuggestions(code, lines, metrics);

      expect(suggestions.some((s: RefactoringSuggestion) => s.description.includes('destructuring'))).toBe(true);
    });
  });

  describe('Full JavaScript Analysis', () => {
    it('should analyze simple JavaScript code', async () => {
      // Mock the readFile method to return simple code
      (analyzer as any).readFile.mockResolvedValueOnce(`function hello(name) {
  return \`Hello, \${name}!\`;
}`);

      const result = await analyzer.analyzeFile('test.js');

      expect(result.language).toBe('javascript');
      expect(result.issues.length).toBeGreaterThanOrEqual(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.functionCount).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('should analyze complex JavaScript code with issues', async () => {
      // Mock the readFile method to return complex code
      (analyzer as any).readFile.mockResolvedValueOnce(`function complexFunction(items) {
  var result = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].valid) {
      result.push(items[i].value);
    }
  }
  try {
    return result;
  } catch (e) {
    console.log("Error occurred");
    return [];
  }
}`);

      const result = await analyzer.analyzeFile('test.js');

      expect(result.language).toBe('javascript');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((issue: AnalysisIssue) => issue.message.includes('let or const instead of var'))).toBe(true);
      expect(result.issues.some((issue: AnalysisIssue) => issue.message.includes('Console statement'))).toBe(true);
      expect(result.metrics.complexity).toBeGreaterThan(1);
    });

    it('should handle empty JavaScript file', async () => {
      // Mock the readFile method to return empty code
      (analyzer as any).readFile.mockResolvedValueOnce('');

      const result = await analyzer.analyzeFile('test.js');

      expect(result.language).toBe('javascript');
      expect(result.metrics.linesOfCode).toBe(0);
      expect(result.metrics.complexity).toBe(1);
    });
  });

  describe('Multiple File Analysis', () => {
    it('should analyze multiple JavaScript files', async () => {
      // Mock the readFile method to return different content for different files
      (analyzer as any).readFile = jest.fn()
        .mockResolvedValueOnce('function file1() { return 1; }')
        .mockResolvedValueOnce('function file2() { return 2; }');

      const results = await analyzer.analyzeFiles(['file1.js', 'file2.js']);

      expect(results).toHaveLength(2);
      expect(results[0].filePath).toBe('file1.js');
      expect(results[1].filePath).toBe('file2.js');
      expect(results[0].language).toBe('javascript');
      expect(results[1].language).toBe('javascript');
    });
  });
});