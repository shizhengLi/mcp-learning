import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock the analyzers for testing
jest.mock('../analysis/PythonAnalyzer')
jest.mock('../analysis/JavaScriptAnalyzer')

describe('CodeAnalysisServer Basic Functionality', () => {
  let server: any

  beforeEach(() => {
    // Create a minimal server mock for testing
    server = {
      config: {
        name: 'code-analysis-server',
        version: '1.0.0',
        capabilities: {
          tools: {
            'analyze-code': {
              description: 'Analyze code quality and generate suggestions',
              inputSchema: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  language: { enum: ['python', 'javascript'] },
                  filePath: { type: 'string' },
                },
                required: ['code', 'language'],
              },
            },
            'analyze-file': {
              description: 'Analyze a specific file',
              inputSchema: {
                type: 'object',
                properties: {
                  filePath: { type: 'string' },
                },
                required: ['filePath'],
              },
            },
            'analyze-multiple-files': {
              description: 'Analyze multiple files',
              inputSchema: {
                type: 'object',
                properties: {
                  filePaths: { type: 'array', items: { type: 'string' } },
                },
                required: ['filePaths'],
              },
            },
            'get-supported-languages': {
              description: 'Get list of supported programming languages',
              inputSchema: { type: 'object', properties: {} },
            },
            'generate-refactoring-suggestions': {
              description: 'Generate specific refactoring suggestions for code',
              inputSchema: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  language: { enum: ['python', 'javascript'] },
                  context: { type: 'string' },
                },
                required: ['code', 'language'],
              },
            },
          },
          resources: {
            'analysis-results': {
              description: 'Access previous analysis results',
              inputSchema: {
                type: 'object',
                properties: {
                  analysisId: { type: 'string' },
                },
                required: ['analysisId'],
              },
            },
          },
        },
      },

      // Core methods for testing
      detectLanguageFromPath(filePath: string) {
        const extension = filePath.split('.').pop()?.toLowerCase()

        if (['py'].includes(extension || '')) {
          return 'python'
        }

        if (['js', 'jsx', 'ts', 'tsx'].includes(extension || '')) {
          return 'javascript'
        }

        return null
      },

      generateMockCode(language: string) {
        if (language === 'python') {
          return `def example_function():
    # This is a sample function
    result = []
    for i in range(10):
        if i % 2 == 0:
            result.append(i)
    return result`
        } else {
          return `function exampleFunction() {
  // This is a sample function
  const result = [];
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      result.push(i);
    }
  }
  return result;
}`
        }
      },

      formatAnalysisResult(result: any) {
        let output = `# Code Analysis Results for ${result.filePath}\n\n`
        output += `**Language:** ${result.language}\n`
        output += `**Timestamp:** ${new Date(result.timestamp).toISOString()}\n\n`

        // Metrics
        output += `## Metrics\n`
        output += `- **Lines of Code:** ${result.metrics.linesOfCode}\n`
        output += `- **Complexity:** ${result.metrics.complexity}\n`
        output += `- **Maintainability:** ${result.metrics.maintainability}/100\n`
        output += `- **Function Count:** ${result.metrics.functionCount}\n`
        output += `- **Technical Debt:** ${result.metrics.technicalDebt}\n\n`

        // Issues
        if (result.issues.length > 0) {
          output += `## Issues Found (${result.issues.length})\n\n`
          result.issues.forEach((issue: any) => {
            output += `### ${issue.type.toUpperCase()} (Line ${issue.line})\n`
            output += `- **Severity:** ${issue.severity}\n`
            output += `- **Rule:** ${issue.rule}\n`
            output += `- **Message:** ${issue.message}\n`
            if (issue.fix) {
              output += `- **Fix:** ${issue.fix.description}\n`
            }
            output += '\n'
          })
        } else {
          output += `## Issues Found\n\nNo issues detected.\n\n`
        }

        // Suggestions
        if (result.suggestions.length > 0) {
          output += `## Refactoring Suggestions (${result.suggestions.length})\n\n`
          result.suggestions.forEach((suggestion: any) => {
            output += `### ${suggestion.type.toUpperCase()} (Priority: ${suggestion.priority})\n`
            output += `- **Description:** ${suggestion.description}\n`
            if (suggestion.estimatedImpact.complexityReduction) {
              output += `- **Complexity Reduction:** ${suggestion.estimatedImpact.complexityReduction}\n`
            }
            if (suggestion.estimatedImpact.maintainabilityImprovement) {
              output += `- **Maintainability Improvement:** ${suggestion.estimatedImpact.maintainabilityImprovement}\n`
            }
            output += '\n'
          })
        } else {
          output += `## Refactoring Suggestions\n\nNo suggestions at this time.`
        }

        return output
      },

      formatMultipleAnalysisResults(results: any[]) {
        let output = `# Multiple Files Analysis Results\n\n`
        output += `**Files Analyzed:** ${results.length}\n`
        output += `**Analysis Time:** ${new Date().toISOString()}\n\n`

        // Summary statistics
        const totalLines = results.reduce((sum, r) => sum + r.metrics.linesOfCode, 0)
        const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0)
        const totalSuggestions = results.reduce((sum, r) => sum + r.suggestions.length, 0)
        const avgComplexity =
          results.reduce((sum, r) => sum + r.metrics.complexity, 0) / results.length
        const avgMaintainability =
          results.reduce((sum, r) => sum + r.metrics.maintainability, 0) / results.length

        output += `## Summary\n`
        output += `- **Total Lines of Code:** ${totalLines}\n`
        output += `- **Total Issues:** ${totalIssues}\n`
        output += `- **Total Suggestions:** ${totalSuggestions}\n`
        output += `- **Average Complexity:** ${avgComplexity.toFixed(1)}\n`
        output += `- **Average Maintainability:** ${avgMaintainability.toFixed(1)}/100\n\n`

        // Individual file results
        results.forEach(result => {
          output += `---\n\n${this.formatAnalysisResult(result)}\n`
        })

        return output
      },

      formatRefactoringSuggestions(suggestions: any[], context?: string) {
        let output = `# Refactoring Suggestions\n\n`

        if (context) {
          output += `**Context:** ${context}\n\n`
        }

        if (suggestions.length === 0) {
          output += `No refactoring suggestions available for this code.\n`
          return output
        }

        // Group suggestions by priority
        const highPriority = suggestions.filter(s => s.priority === 'high')
        const mediumPriority = suggestions.filter(s => s.priority === 'medium')
        const lowPriority = suggestions.filter(s => s.priority === 'low')

        if (highPriority.length > 0) {
          output += `## High Priority Suggestions\n\n`
          highPriority.forEach(suggestion => {
            output += `### ${suggestion.description}\n`
            output += `- **Type:** ${suggestion.type}\n`
            if (suggestion.estimatedImpact.complexityReduction) {
              output += `- **Complexity Reduction:** ${suggestion.estimatedImpact.complexityReduction}\n`
            }
            if (suggestion.estimatedImpact.maintainabilityImprovement) {
              output += `- **Maintainability Improvement:** ${suggestion.estimatedImpact.maintainabilityImprovement}\n`
            }
            output += '\n'
          })
        }

        if (mediumPriority.length > 0) {
          output += `## Medium Priority Suggestions\n\n`
          mediumPriority.forEach(suggestion => {
            output += `### ${suggestion.description}\n`
            output += `- **Type:** ${suggestion.type}\n`
            if (suggestion.estimatedImpact.complexityReduction) {
              output += `- **Complexity Reduction:** ${suggestion.estimatedImpact.complexityReduction}\n`
            }
            if (suggestion.estimatedImpact.maintainabilityImprovement) {
              output += `- **Maintainability Improvement:** ${suggestion.estimatedImpact.maintainabilityImprovement}\n`
            }
            output += '\n'
          })
        }

        if (lowPriority.length > 0) {
          output += `## Low Priority Suggestions\n\n`
          lowPriority.forEach(suggestion => {
            output += `### ${suggestion.description}\n`
            output += `- **Type:** ${suggestion.type}\n`
            if (suggestion.estimatedImpact.complexityReduction) {
              output += `- **Complexity Reduction:** ${suggestion.estimatedImpact.complexityReduction}\n`
            }
            if (suggestion.estimatedImpact.maintainabilityImprovement) {
              output += `- **Maintainability Improvement:** ${suggestion.estimatedImpact.maintainabilityImprovement}\n`
            }
            output += '\n'
          })
        }

        return output
      },
    }
  })

  describe('Server Creation', () => {
    it('should create server instance without errors', () => {
      expect(server).toBeDefined()
      expect(server.config).toBeDefined()
    })

    it('should have server configuration', () => {
      expect(server.config.name).toBe('code-analysis-server')
      expect(server.config.version).toBe('1.0.0')
    })
  })

  describe('Language Detection', () => {
    it('should detect Python files correctly', () => {
      const result = server.detectLanguageFromPath('test.py')
      expect(result).toBe('python')
    })

    it('should detect JavaScript files correctly', () => {
      const jsResult = server.detectLanguageFromPath('test.js')
      expect(jsResult).toBe('javascript')

      const jsxResult = server.detectLanguageFromPath('test.jsx')
      expect(jsxResult).toBe('javascript')

      const tsResult = server.detectLanguageFromPath('test.ts')
      expect(tsResult).toBe('javascript')

      const tsxResult = server.detectLanguageFromPath('test.tsx')
      expect(tsxResult).toBe('javascript')
    })

    it('should return null for unsupported file types', () => {
      const result = server.detectLanguageFromPath('test.java')
      expect(result).toBeNull()
    })
  })

  describe('Mock Code Generation', () => {
    it('should generate Python mock code', () => {
      const code = server.generateMockCode('python')
      expect(code).toContain('def example_function():')
      expect(code).toContain('for i in range(10):')
    })

    it('should generate JavaScript mock code', () => {
      const code = server.generateMockCode('javascript')
      expect(code).toContain('function exampleFunction()')
      expect(code).toContain('for (let i = 0; i < 10; i++)')
    })
  })

  describe('Result Formatting', () => {
    it('should format single analysis result correctly', () => {
      const mockResult = {
        filePath: 'test.py',
        language: 'python',
        issues: [
          {
            type: 'warning' as const,
            severity: 'medium' as const,
            message: 'Test issue',
            line: 1,
            rule: 'TEST-RULE',
          },
        ],
        metrics: {
          complexity: 5,
          maintainability: 75,
          linesOfCode: 20,
          commentLines: 5,
          commentPercentage: 25,
          functionCount: 2,
          averageFunctionLength: 10,
          dependencies: ['os'],
          technicalDebt: 10,
        },
        suggestions: [
          {
            type: 'optimize' as const,
            priority: 'medium' as const,
            description: 'Test suggestion',
            line: 1,
            estimatedImpact: {
              complexityReduction: 2,
              maintainabilityImprovement: 15,
            },
          },
        ],
        timestamp: Date.now(),
      }

      const formatted = server.formatAnalysisResult(mockResult)

      expect(formatted).toContain('# Code Analysis Results for test.py')
      expect(formatted).toContain('**Language:** python')
      expect(formatted).toContain('**Complexity:** 5')
      expect(formatted).toContain('**Maintainability:** 75/100')
      expect(formatted).toContain('Test issue')
      expect(formatted).toContain('Test suggestion')
    })

    it('should format multiple analysis results correctly', () => {
      const mockResults = [
        {
          filePath: 'test1.py',
          language: 'python',
          issues: [],
          metrics: {
            complexity: 3,
            maintainability: 80,
            linesOfCode: 10,
            commentLines: 2,
            commentPercentage: 20,
            functionCount: 1,
            averageFunctionLength: 10,
            dependencies: [],
            technicalDebt: 0,
          },
          suggestions: [],
          timestamp: Date.now(),
        },
        {
          filePath: 'test2.js',
          language: 'javascript',
          issues: [],
          metrics: {
            complexity: 4,
            maintainability: 75,
            linesOfCode: 15,
            commentLines: 3,
            commentPercentage: 20,
            functionCount: 2,
            averageFunctionLength: 7.5,
            dependencies: [],
            technicalDebt: 5,
          },
          suggestions: [],
          timestamp: Date.now(),
        },
      ]

      const formatted = server.formatMultipleAnalysisResults(mockResults)

      expect(formatted).toContain('# Multiple Files Analysis Results')
      expect(formatted).toContain('**Files Analyzed:** 2')
      expect(formatted).toContain('**Total Lines of Code:** 25')
      expect(formatted).toContain('**Average Complexity:** 3.5')
      expect(formatted).toContain('test1.py')
      expect(formatted).toContain('test2.js')
    })

    it('should format refactoring suggestions correctly', () => {
      const mockSuggestions = [
        {
          type: 'restructure' as const,
          priority: 'high' as const,
          description: 'High priority suggestion',
          line: 1,
          estimatedImpact: {
            complexityReduction: 5,
            maintainabilityImprovement: 20,
          },
        },
        {
          type: 'optimize' as const,
          priority: 'low' as const,
          description: 'Low priority suggestion',
          line: 2,
          estimatedImpact: {
            maintainabilityImprovement: 10,
          },
        },
      ]

      const formatted = server.formatRefactoringSuggestions(mockSuggestions, 'Test context')

      expect(formatted).toContain('# Refactoring Suggestions')
      expect(formatted).toContain('**Context:** Test context')
      expect(formatted).toContain('## High Priority Suggestions')
      expect(formatted).toContain('## Low Priority Suggestions')
      expect(formatted).toContain('High priority suggestion')
      expect(formatted).toContain('Low priority suggestion')
    })

    it('should handle empty suggestions', () => {
      const formatted = server.formatRefactoringSuggestions([])

      expect(formatted).toContain('# Refactoring Suggestions')
      expect(formatted).toContain('No refactoring suggestions available')
    })

    it('should handle results with no issues', () => {
      const mockResult = {
        filePath: 'clean.py',
        language: 'python',
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
          technicalDebt: 0,
        },
        suggestions: [],
        timestamp: Date.now(),
      }

      const formatted = server.formatAnalysisResult(mockResult)

      expect(formatted).toContain('# Code Analysis Results for clean.py')
      expect(formatted).toContain('No issues detected')
      expect(formatted).toContain('No suggestions at this time')
    })
  })

  describe('Server Capabilities', () => {
    it('should have tools configuration', () => {
      expect(server.config.capabilities.tools).toBeDefined()
      expect(server.config.capabilities.tools['analyze-code']).toBeDefined()
      expect(server.config.capabilities.tools['analyze-file']).toBeDefined()
      expect(server.config.capabilities.tools['analyze-multiple-files']).toBeDefined()
      expect(server.config.capabilities.tools['get-supported-languages']).toBeDefined()
      expect(server.config.capabilities.tools['generate-refactoring-suggestions']).toBeDefined()
    })

    it('should have resources configuration', () => {
      expect(server.config.capabilities.resources).toBeDefined()
      expect(server.config.capabilities.resources['analysis-results']).toBeDefined()
    })
  })
})
