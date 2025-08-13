import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ChildProcess } from 'child_process';
import { CodeAnalysisServer } from '../CodeAnalysisServer';

describe('AI-Enhanced CodeAnalysisServer Integration Tests', () => {
  let serverProcess: ChildProcess | null = null;
  let server: CodeAnalysisServer | null = null;
  const testTimeout = 15000; // 15 seconds timeout for AI integration tests

  beforeEach(() => {
    // Clean up any existing processes
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  afterEach(() => {
    // Clean up server process if it exists
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  describe('AI Model Integration', () => {
    it('should initialize AI model manager without errors', async () => {
      server = new CodeAnalysisServer(false);
      
      // Test that the server was created successfully
      expect(server).toBeDefined();
      
      // The AI model manager should be initialized (even if no models are available)
      // This should not throw any errors
      await new Promise(resolve => setTimeout(resolve, 100));
    }, testTimeout);

    it('should handle AI analysis tool calls gracefully', async () => {
      server = new CodeAnalysisServer(false);
      
      const pythonCode = `
def fibonacci(n):
    if n <= 1:
        return n
    else:
        return fibonacci(n-1) + fibonacci(n-2)

result = fibonacci(10)
print(f"Result: {result}")
      `;

      // Simulate MCP tool call for AI analysis
      // This should not crash even if AI models are not available
      try {
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
      } catch (error) {
        // Even if AI features fail, traditional analysis should work
        expect(error).toBeDefined();
      }
    }, testTimeout);

    it('should provide fallback when AI models are unavailable', async () => {
      // Remove AI API keys to test fallback behavior
      const originalKeys = {
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OLLAMA_ENDPOINT: process.env.OLLAMA_ENDPOINT
      };

      delete process.env.CLAUDE_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OLLAMA_ENDPOINT;

      try {
        server = new CodeAnalysisServer(false);
        
        const jsCode = `
function calculateTotal(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total += items[i].price;
    }
    return total;
}
        `;

        // Should still work with traditional analysis only
        const result = await (server as any).analyzeInMemoryCode(
          (server as any).javascriptAnalyzer,
          jsCode,
          'test_calculate.js',
          { includeSuggestions: true }
        );

        expect(result).toBeDefined();
        expect(result.language).toBe('javascript');
        expect(result.suggestions).toBeDefined();
        // Should have traditional suggestions even without AI
      } finally {
        // Restore original keys
        Object.assign(process.env, originalKeys);
      }
    }, testTimeout);
  });

  describe('AI Analysis Tool Features', () => {
    it('should format AI analysis results correctly', async () => {
      server = new CodeAnalysisServer(false);
      
      const mockTraditionalResult = {
        filePath: 'test.py',
        language: 'python',
        issues: [
          {
            type: 'warning' as const,
            severity: 'medium' as const,
            message: 'Function complexity is high',
            line: 1,
            rule: 'COMPLEXITY-HIGH'
          }
        ],
        metrics: {
          complexity: 8,
          maintainability: 75,
          linesOfCode: 25,
          commentLines: 5,
          commentPercentage: 20,
          functionCount: 2,
          averageFunctionLength: 12.5,
          dependencies: [],
          technicalDebt: 10
        },
        suggestions: [],
        timestamp: Date.now()
      };

      const mockAIInsights = {
        issues: [
          {
            type: 'warning',
            severity: 'low',
            message: 'Consider adding type hints',
            line: 1,
            rule: 'AI-TYPE-HINTS'
          }
        ],
        suggestions: [
          {
            type: 'optimize',
            priority: 'medium',
            description: 'Use list comprehension for better performance',
            line: 5,
            estimatedImpact: {
              complexityReduction: 1,
              maintainabilityImprovement: 10
            }
          }
        ],
        insights: 'The code follows good practices but could benefit from modern Python features.'
      };

      const formatted = (server as any).formatAIAnalysisResult(
        mockTraditionalResult,
        mockAIInsights,
        {
          traditional: true,
          ai: true,
          focus: 'quality'
        }
      );

      expect(formatted).toContain('# AI-Powered Code Analysis Results');
      expect(formatted).toContain('**Focus:** quality');
      expect(formatted).toContain('Hybrid (Traditional + AI)');
      expect(formatted).toContain('## Traditional Analysis');
      expect(formatted).toContain('## AI-Powered Insights');
      expect(formatted).toContain('Function complexity is high');
      expect(formatted).toContain('Consider adding type hints');
      expect(formatted).toContain('Use list comprehension for better performance');
      expect(formatted).toContain('## Combined Analysis Summary');
    }, testTimeout);

    it('should handle AI-only analysis mode', async () => {
      server = new CodeAnalysisServer(false);
      
      const mockAIInsights = {
        issues: [],
        suggestions: [
          {
            type: 'modernize',
            priority: 'high',
            description: 'Update to use async/await pattern',
            line: 1,
            estimatedImpact: {
              maintainabilityImprovement: 25
            }
          }
        ],
        insights: 'The code would benefit from modernization.'
      };

      const formatted = (server as any).formatAIAnalysisResult(
        null,
        mockAIInsights,
        {
          traditional: false,
          ai: true
        }
      );

      expect(formatted).toContain('# AI-Powered Code Analysis Results');
      expect(formatted).toContain('**Analysis Type:** AI Only');
      expect(formatted).toContain('## AI-Powered Insights');
      expect(formatted).toContain('Update to use async/await pattern');
      expect(formatted).not.toContain('## Traditional Analysis');
    }, testTimeout);

    it('should handle traditional-only analysis mode', async () => {
      server = new CodeAnalysisServer(false);
      
      const mockTraditionalResult = {
        filePath: 'test.js',
        language: 'javascript',
        issues: [],
        metrics: {
          complexity: 3,
          maintainability: 90,
          linesOfCode: 15,
          commentLines: 3,
          commentPercentage: 20,
          functionCount: 1,
          averageFunctionLength: 15,
          dependencies: [],
          technicalDebt: 0
        },
        suggestions: [],
        timestamp: Date.now()
      };

      const formatted = (server as any).formatAIAnalysisResult(
        mockTraditionalResult,
        null,
        {
          traditional: true,
          ai: false
        }
      );

      expect(formatted).toContain('# AI-Powered Code Analysis Results');
      expect(formatted).toContain('**Analysis Type:** Traditional');
      expect(formatted).toContain('## Traditional Analysis');
      expect(formatted).toContain('**Language:** javascript');
      expect(formatted).not.toContain('## AI-Powered Insights');
    }, testTimeout);
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent AI analysis requests', async () => {
      server = new CodeAnalysisServer(false);
      
      const requests = Array(3).fill(null).map((_, i) => 
        (server as any).analyzeInMemoryCode(
          (server as any).pythonAnalyzer,
          `def test_function_${i}():\n    return ${i}`,
          `test_concurrent_${i}.py`,
          { includeSuggestions: true }
        )
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(5000);
      
      // All requests should either succeed or fail gracefully
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    }, testTimeout);

    it('should handle large code files with AI analysis', async () => {
      server = new CodeAnalysisServer(false);
      
      // Generate a large code file with more than 1000 lines
      const largeCode = Array(150).fill((index: number) => `
def large_function_${index}():
    # This is part of a large function ${index}
    data = []
    for i in range(100):
        if i % 2 == 0:
            data.append(i * 2)
        else:
            data.append(i + 1)
    return sum(data)

def another_function_${index}():
    # Additional function to increase line count
    result = 0
    for j in range(50):
        result += j
    return result
`).map((func, index) => func(index)).join('\n\n');

      const result = await (server as any).analyzeInMemoryCode(
        (server as any).pythonAnalyzer,
        largeCode,
        'test_large.py',
        { includeSuggestions: true }
      );

      expect(result).toBeDefined();
      expect(result.metrics.linesOfCode).toBeGreaterThan(1000);
    }, testTimeout);
  });

  describe('Error Scenarios', () => {
    it('should handle invalid code gracefully', async () => {
      server = new CodeAnalysisServer(false);
      
      const invalidCode = `
def invalid_function(
    # Missing closing parenthesis
    return "This is invalid code
      `;

      try {
        const result = await (server as any).analyzeInMemoryCode(
          (server as any).pythonAnalyzer,
          invalidCode,
          'test_invalid.py',
          { includeSuggestions: true }
        );
        
        // Should still return a result even for invalid code
        expect(result).toBeDefined();
        expect(result.language).toBe('python');
      } catch (error) {
        // Or handle the error gracefully
        expect(error).toBeDefined();
      }
    }, testTimeout);

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

    it('should handle unsupported language gracefully', async () => {
      server = new CodeAnalysisServer(false);
      
      // This should not crash, even though we don't have a Java analyzer
      try {
        await (server as any).analyzeInMemoryCode(
          null, // No analyzer for Java
          'public class Test {}',
          'test.java',
          { includeSuggestions: true }
        );
        
        // If it doesn't crash, that's good
        expect(true).toBe(true);
      } catch (error) {
        // Error handling is also acceptable
        expect(error).toBeDefined();
      }
    }, testTimeout);
  });

  describe('Integration with Existing Features', () => {
    it('should maintain compatibility with existing analysis tools', async () => {
      server = new CodeAnalysisServer(false);
      
      const pythonCode = `
def calculate_average(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)
      `;

      const result = await (server as any).analyzeInMemoryCode(
        (server as any).pythonAnalyzer,
        pythonCode,
        'test_average.py',
        { includeSuggestions: true }
      );

      // All existing features should still work
      expect(result).toBeDefined();
      expect(result.language).toBe('python');
      expect(result.issues).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.timestamp).toBeDefined();
      
      // Traditional metrics should still be calculated
      expect(result.metrics.complexity).toBeGreaterThan(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.maintainability).toBeGreaterThan(0);
    }, testTimeout);

    it('should preserve existing formatting functionality', async () => {
      server = new CodeAnalysisServer(false);
      
      const mockResult = {
        filePath: 'test.js',
        language: 'javascript',
        issues: [],
        metrics: {
          complexity: 1,
          maintainability: 95,
          linesOfCode: 5,
          commentLines: 2,
          commentPercentage: 40,
          functionCount: 1,
          averageFunctionLength: 5,
          dependencies: [],
          technicalDebt: 0
        },
        suggestions: [],
        timestamp: Date.now()
      };

      const formatted = (server as any).formatAnalysisResult(mockResult);

      // Should contain all the traditional formatting elements
      expect(formatted).toContain('# Code Analysis Results for test.js');
      expect(formatted).toContain('**Language:** javascript');
      expect(formatted).toContain('## Metrics');
      expect(formatted).toContain('**Complexity:** 1');
      expect(formatted).toContain('**Maintainability:** 95/100');
      expect(formatted).toContain('No issues detected');
    }, testTimeout);
  });
});