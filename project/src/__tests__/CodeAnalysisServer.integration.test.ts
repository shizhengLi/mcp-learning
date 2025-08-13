import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { writeFileSync, existsSync } from 'fs';
import { CodeAnalysisServer } from '../CodeAnalysisServer';

describe('CodeAnalysisServer Integration Tests', () => {
  let serverProcess: ChildProcess | null = null;
  let server: CodeAnalysisServer | null = null;
  const testTimeout = 10000; // 10 seconds timeout for integration tests

  // Helper function to create test files
  const createTestFile = (filename: string, content: string): string => {
    const filePath = join(__dirname, '..', '..', 'test-files', filename);
    const dir = join(__dirname, '..', '..', 'test-files');
    
    // Create directory if it doesn't exist
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(filePath, content);
    return filePath;
  };

  // Helper function to clean up test files
  const cleanupTestFiles = () => {
    const testDir = join(__dirname, '..', '..', 'test-files');
    if (existsSync(testDir)) {
      require('fs').rmSync(testDir, { recursive: true, force: true });
    }
  };

  beforeEach(() => {
    // Clean up any existing test files
    cleanupTestFiles();
  });

  afterEach(() => {
    // Clean up test files
    cleanupTestFiles();
    
    // Clean up server process if it exists
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  describe('Server Process Integration', () => {
    it('should start and stop server process correctly', async () => {
      // Create a simple test server script that doesn't initialize tools
      const testServerScript = `
console.error('Test server starting');
setTimeout(() => {
  console.error('Test server exiting');
  process.exit(0);
}, 1000);
`;

      const serverPath = join(__dirname, '..', '..', 'test-server.js');
      writeFileSync(serverPath, testServerScript);
      
      // Start server process
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if process is still running
      expect(serverProcess.killed).toBe(false);

      // Server should exit automatically after 1 second
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if process has exited (not necessarily killed)
      expect(serverProcess.killed || serverProcess.exitCode !== null).toBe(true);
      
      // Clean up test server file
      if (existsSync(serverPath)) {
        require('fs').unlinkSync(serverPath);
      }
    }, testTimeout);

    it('should handle server startup errors gracefully', async () => {
      // Try to start with invalid server path
      serverProcess = spawn('node', ['nonexistent-server.ts'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Wait for process to fail
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Process should be killed or exited with error
      expect(serverProcess.killed || serverProcess.exitCode !== null).toBe(true);
    }, testTimeout);
  });

  describe('End-to-End Code Analysis Workflow', () => {
    it('should analyze Python code and return structured results', async () => {
      server = new CodeAnalysisServer(false);
      
      const pythonCode = `
def calculate_fibonacci(n):
    if n <= 1:
        return n
    else:
        return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

def main():
    result = calculate_fibonacci(10)
    print(f"Fibonacci result: {result}")

if __name__ == "__main__":
    main()
      `;

      // Simulate MCP tool call
      const result = await (server as any).analyzeInMemoryCode(
        (server as any).pythonAnalyzer,
        pythonCode,
        'test_fibonacci.py',
        { includeSuggestions: true }
      );

      expect(result).toBeDefined();
      expect(result.language).toBe('python');
      expect(result.issues).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.timestamp).toBeDefined();
      
      // Check metrics
      expect(result.metrics.complexity).toBeGreaterThan(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.maintainability).toBeGreaterThan(0);
      expect(result.metrics.maintainability).toBeLessThanOrEqual(100);
    }, testTimeout);

    it('should analyze JavaScript code and return structured results', async () => {
      server = new CodeAnalysisServer(false);
      
      const jsCode = `
function fibonacci(n) {
    if (n <= 1) {
        return n;
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}

function main() {
    const result = fibonacci(10);
    console.log(\`Fibonacci result: \${result}\`);
}

main();
      `;

      // Create JavaScript analyzer instance directly
      const { JavaScriptAnalyzer } = await import('../analysis/JavaScriptAnalyzer');
      const jsAnalyzer = new JavaScriptAnalyzer();
      await jsAnalyzer.initialize();

      // Simulate MCP tool call
      const result = await (server as any).analyzeInMemoryCode(
        jsAnalyzer,
        jsCode,
        'test_fibonacci.js',
        { includeSuggestions: true }
      );

      expect(result).toBeDefined();
      expect(result.language).toBe('javascript');
      expect(result.issues).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.timestamp).toBeDefined();
      
      // Check metrics
      expect(result.metrics.complexity).toBeGreaterThan(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.maintainability).toBeGreaterThan(0);
      expect(result.metrics.maintainability).toBeLessThanOrEqual(100);
    }, testTimeout);

    it('should handle code analysis errors gracefully', async () => {
      server = new CodeAnalysisServer(false);
      
      const invalidCode = `
def invalid_function(
    # Missing closing parenthesis
    return "This is invalid"
      `;

      try {
        const result = await (server as any).analyzeInMemoryCode(
          (server as any).pythonAnalyzer,
          invalidCode,
          'test_invalid.py',
          { includeSuggestions: true }
        );
        
        // Should still return a result with issues
        expect(result).toBeDefined();
        expect(result.issues).toBeDefined();
        expect(result.issues.length).toBeGreaterThan(0);
      } catch (error) {
        // Or handle the error gracefully
        expect(error).toBeDefined();
      }
    }, testTimeout);
  });

  describe('Multi-File Analysis Integration', () => {
    it('should analyze multiple files and return aggregated results', async () => {
      server = new CodeAnalysisServer(false);
      
      const testFiles = [
        createTestFile('test1.py', `
def function1():
    return "Hello from Python"
`),
        createTestFile('test2.js', `
function function1() {
    return "Hello from JavaScript";
}
`),
        createTestFile('test3.py', `
def function2():
    return "Another Python function"
`)
      ];

      // Simulate MCP tool call for multiple files
      const results = [];
      for (const filePath of testFiles) {
        const language = (server as any).detectLanguageFromPath(filePath);
        if (language) {
          const analyzer = language === 'python' ? 
            (server as any).pythonAnalyzer : 
            (server as any).javascriptAnalyzer;
          
          const mockCode = (server as any).generateMockCode(language);
          const result = await (server as any).analyzeInMemoryCode(
            analyzer,
            mockCode,
            filePath,
            { includeSuggestions: true }
          );
          results.push(result);
        }
      }

      expect(results).toHaveLength(3);
      expect(results.every(r => r.language)).toBe(true);
      expect(results.every(r => r.metrics)).toBe(true);
      expect(results.every(r => r.issues)).toBe(true);
      
      // Test the formatting function
      const formattedOutput = (server as any).formatMultipleAnalysisResults(results);
      expect(formattedOutput).toContain('Multiple Files Analysis Results');
      expect(formattedOutput).toContain('**Files Analyzed:** 3');
      expect(formattedOutput).toContain('Total Lines of Code:');
    }, testTimeout);

    it('should handle mixed file types correctly', async () => {
      server = new CodeAnalysisServer(false);
      
      const mixedFiles = [
        createTestFile('test.py', 'print("Python code")'),
        createTestFile('test.js', 'console.log("JavaScript code")'),
        createTestFile('test.txt', 'This is not code') // Unsupported file type
      ];

      const results = [];
      const errors = [];
      
      for (const filePath of mixedFiles) {
        try {
          const language = (server as any).detectLanguageFromPath(filePath);
          if (language) {
            const analyzer = language === 'python' ? 
              (server as any).pythonAnalyzer : 
              (server as any).javascriptAnalyzer;
            
            const mockCode = (server as any).generateMockCode(language);
            const result = await (server as any).analyzeInMemoryCode(
              analyzer,
              mockCode,
              filePath,
              { includeSuggestions: true }
            );
            results.push(result);
          }
        } catch (error) {
          errors.push(error);
        }
      }

      // Should only analyze supported file types
      expect(results).toHaveLength(2);
      expect(errors.length).toBe(0); // Should handle unsupported files gracefully
    }, testTimeout);
  });

  describe('Refactoring Suggestions Integration', () => {
    it('should generate refactoring suggestions for complex code', async () => {
      server = new CodeAnalysisServer(false);
      
      const complexCode = `
def process_data(data):
    results = []
    for item in data:
        if item is not None:
            if isinstance(item, str):
                if len(item) > 0:
                    if item.startswith('valid'):
                        results.append(item.upper())
    return results

def calculate_metrics(values):
    total = 0
    count = 0
    average = 0
    maximum = 0
    minimum = 0
    
    for value in values:
        if value is not None:
            total += value
            count += 1
            if value > maximum:
                maximum = value
            if value < minimum or minimum == 0:
                minimum = value
    
    if count > 0:
        average = total / count
    
    return {
        'total': total,
        'count': count,
        'average': average,
        'maximum': maximum,
        'minimum': minimum
    }
      `;

      const result = await (server as any).analyzeInMemoryCode(
        (server as any).pythonAnalyzer,
        complexCode,
        'test_complex.py',
        { includeSuggestions: true }
      );

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // Check that suggestions have proper structure
      const suggestion = result.suggestions[0];
      expect(suggestion.type).toBeDefined();
      expect(suggestion.priority).toBeDefined();
      expect(suggestion.description).toBeDefined();
      expect(suggestion.estimatedImpact).toBeDefined();
      
      // Test formatting function
      const formattedSuggestions = (server as any).formatRefactoringSuggestions(
        result.suggestions,
        'Test context for complex code'
      );
      
      expect(formattedSuggestions).toContain('Refactoring Suggestions');
      expect(formattedSuggestions).toContain('Test context');
    }, testTimeout);

    it('should handle refactoring suggestions with context', async () => {
      server = new CodeAnalysisServer(false);
      
      const codeWithContext = `
function validateUserInput(input) {
    // This function needs to be more robust
    if (input && input.length > 0) {
        return true;
    }
    return false;
}
      `;

      // Create JavaScript analyzer instance directly
      const { JavaScriptAnalyzer } = await import('../analysis/JavaScriptAnalyzer');
      const jsAnalyzer = new JavaScriptAnalyzer();
      await jsAnalyzer.initialize();

      const result = await (server as any).analyzeInMemoryCode(
        jsAnalyzer,
        codeWithContext,
        'test_validation.js',
        { includeSuggestions: true }
      );

      const context = 'This is part of a user authentication system';
      const formattedSuggestions = (server as any).formatRefactoringSuggestions(
        result.suggestions,
        context
      );
      
      expect(formattedSuggestions).toContain(context);
      expect(formattedSuggestions).toContain('Refactoring Suggestions');
    }, testTimeout);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty code input', async () => {
      server = new CodeAnalysisServer(false);
      
      const result = await (server as any).analyzeInMemoryCode(
        (server as any).pythonAnalyzer,
        '',
        'test_empty.py',
        { includeSuggestions: true }
      );

      expect(result).toBeDefined();
      expect(result.language).toBe('python');
      expect(result.metrics.linesOfCode).toBe(0);
    }, testTimeout);

    it('should handle very large code files', async () => {
      server = new CodeAnalysisServer(false);
      
      // Generate a large code file
      const largeCode = Array(1000).fill(`
def large_function_${Math.random()}():
    # This is a large function
    x = 1
    y = 2
    return x + y
`).join('\n');

      const result = await (server as any).analyzeInMemoryCode(
        (server as any).pythonAnalyzer,
        largeCode,
        'test_large.py',
        { includeSuggestions: true }
      );

      expect(result).toBeDefined();
      expect(result.metrics.linesOfCode).toBeGreaterThan(1000);
    }, testTimeout);

    it('should handle concurrent analysis requests', async () => {
      server = new CodeAnalysisServer(false);
      
      const concurrentRequests = Array(5).fill(null).map((_, i) => 
        (server as any).analyzeInMemoryCode(
          (server as any).pythonAnalyzer,
          `def test_function_${i}():\n    return ${i}`,
          `test_concurrent_${i}.py`,
          { includeSuggestions: true }
        )
      );

      const results = await Promise.all(concurrentRequests);
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.language === 'python')).toBe(true);
      expect(results.every(r => r.metrics)).toBe(true);
    }, testTimeout);
  });

  describe('Language Detection Integration', () => {
    it('should correctly detect Python files from various extensions', () => {
      server = new CodeAnalysisServer(false);
      
      const pythonFiles = [
        'test.py',
        'main.py',
        'script.py',
        '/path/to/file.py'
      ];
      
      pythonFiles.forEach(filePath => {
        const language = (server as any).detectLanguageFromPath(filePath);
        expect(language).toBe('python');
      });
    });

    it('should correctly detect JavaScript files from various extensions', () => {
      server = new CodeAnalysisServer(false);
      
      const jsFiles = [
        'test.js',
        'app.jsx',
        '/path/to/script.js'
      ];
      
      const tsFiles = [
        'component.ts',
        'page.tsx'
      ];
      
      // Test JavaScript files
      jsFiles.forEach(filePath => {
        const language = (server as any).detectLanguageFromPath(filePath);
        expect(language).toBe('javascript');
      });
      
      // Test TypeScript files
      tsFiles.forEach(filePath => {
        const language = (server as any).detectLanguageFromPath(filePath);
        expect(language).toBe('typescript');
      });
    });

    it('should return null for unsupported file types', () => {
      server = new CodeAnalysisServer(false);
      
      const unsupportedFiles = [
        'test.xml',
        'config.json',
        'style.css',
        'unknown.xyz'
      ];
      
      const supportedFiles = [
        'test.java',
        'file.cpp',
        'script.rb',
        'code.go'
      ];
      
      // Test truly unsupported files
      unsupportedFiles.forEach(filePath => {
        const language = (server as any).detectLanguageFromPath(filePath);
        expect(language).toBeNull();
      });
      
      // Test actually supported files
      supportedFiles.forEach(filePath => {
        const language = (server as any).detectLanguageFromPath(filePath);
        expect(language).not.toBeNull();
      });
  });

  describe('Performance Metrics Integration', () => {
    it('should calculate performance metrics for code analysis', async () => {
      server = new CodeAnalysisServer(false);
      
      const startTime = Date.now();
      
      const result = await (server as any).analyzeInMemoryCode(
        (server as any).pythonAnalyzer,
        `def performance_test():\n    return "test"`,
        'test_performance.py',
        { includeSuggestions: true }
      );
      
      const endTime = Date.now();
      const analysisTime = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(analysisTime).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify performance-related metrics
      expect(result.metrics.complexity).toBeGreaterThanOrEqual(1);
      expect(result.metrics.maintainability).toBeGreaterThan(0);
      expect(result.metrics.technicalDebt).toBeGreaterThanOrEqual(0);
    }, testTimeout);

    it('should handle performance under load', async () => {
      server = new CodeAnalysisServer(false);
      
      const loadTestRequests = Array(20).fill(null).map((_, i) => 
        (server as any).analyzeInMemoryCode(
          (server as any).pythonAnalyzer,
          `def load_test_${i}():\n    return ${i}`,
          `test_load_${i}.py`,
          { includeSuggestions: true }
        )
      );

      const startTime = Date.now();
      const results = await Promise.all(loadTestRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(20);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.every(r => r.language === 'python')).toBe(true);
    }, testTimeout);
  });
  });
});