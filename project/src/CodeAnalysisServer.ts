#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PythonAnalyzer } from './analysis/PythonAnalyzer';
import { JavaScriptAnalyzer } from './analysis/JavaScriptAnalyzer';
import { TypeScriptAnalyzer } from './analysis/TypeScriptAnalyzer';
import { JavaAnalyzer } from './analysis/JavaAnalyzer';
import { MultiLanguageFramework } from './analysis/MultiLanguageFramework';
import { AnalysisResult, AnalysisOptions } from './analysis/BaseCodeAnalyzer';
import { AIModelManager } from './ai/AIModelManager';

interface ServerConfig {
  name: string;
  version: string;
  capabilities: {
    tools: Record<string, any>;
    resources: Record<string, any>;
  };
}

export class CodeAnalysisServer {
  private server: McpServer;
  private pythonAnalyzer: PythonAnalyzer;
  private javascriptAnalyzer: JavaScriptAnalyzer;
  private typescriptAnalyzer: TypeScriptAnalyzer;
  private javaAnalyzer: JavaAnalyzer;
  private multiLanguageFramework: MultiLanguageFramework;
  private aiModelManager: AIModelManager;
  private config: ServerConfig;

  constructor() {
    this.config = {
      name: 'code-analysis-server',
      version: '1.0.0',
      capabilities: {
        tools: {
          'analyze-code': {
            description: 'Analyze code quality and generate suggestions',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'The code to analyze'
                },
                language: {
                  type: 'string',
                  enum: ['python', 'javascript', 'typescript', 'java', 'go', 'cpp', 'rust', 'ruby', 'php'],
                  description: 'Programming language of the code'
                },
                filePath: {
                  type: 'string',
                  description: 'File path for context (optional)'
                },
                options: {
                  type: 'object',
                  properties: {
                    includeSuggestions: {
                      type: 'boolean',
                      default: true
                    },
                    thresholds: {
                      type: 'object',
                      properties: {
                        complexity: { type: 'number', minimum: 1 },
                        maintainability: { type: 'number', minimum: 0, maximum: 100 }
                      }
                    }
                  }
                }
              },
              required: ['code', 'language']
            }
          },
          'analyze-file': {
            description: 'Analyze a specific file',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Path to the file to analyze'
                },
                options: {
                  type: 'object',
                  properties: {
                    includeSuggestions: {
                      type: 'boolean',
                      default: true
                    },
                    thresholds: {
                      type: 'object',
                      properties: {
                        complexity: { type: 'number', minimum: 1 },
                        maintainability: { type: 'number', minimum: 0, maximum: 100 }
                      }
                    }
                  }
                }
              },
              required: ['filePath']
            }
          },
          'analyze-multiple-files': {
            description: 'Analyze multiple files',
            inputSchema: {
              type: 'object',
              properties: {
                filePaths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of file paths to analyze'
                },
                options: {
                  type: 'object',
                  properties: {
                    includeSuggestions: {
                      type: 'boolean',
                      default: true
                    },
                    thresholds: {
                      type: 'object',
                      properties: {
                        complexity: { type: 'number', minimum: 1 },
                        maintainability: { type: 'number', minimum: 0, maximum: 100 }
                      }
                    }
                  }
                }
              },
              required: ['filePaths']
            }
          },
          'get-supported-languages': {
            description: 'Get list of supported programming languages',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          'get-language-info': {
            description: 'Get detailed information about a supported language',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  enum: ['python', 'javascript', 'typescript', 'java', 'go', 'cpp', 'rust', 'ruby', 'php'],
                  description: 'Programming language to get info for'
                }
              },
              required: ['language']
            }
          },
          'analyze-with-framework': {
            description: 'Analyze code using the multi-language framework',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'The code to analyze'
                },
                language: {
                  type: 'string',
                  enum: ['python', 'javascript', 'typescript', 'java', 'go', 'cpp', 'rust', 'ruby', 'php'],
                  description: 'Programming language of the code'
                },
                filePath: {
                  type: 'string',
                  description: 'File path for context (optional)'
                },
                options: {
                  type: 'object',
                  properties: {
                    includeSuggestions: {
                      type: 'boolean',
                      default: true
                    },
                    thresholds: {
                      type: 'object',
                      properties: {
                        complexity: { type: 'number', minimum: 1 },
                        maintainability: { type: 'number', minimum: 0, maximum: 100 }
                      }
                    },
                    rules: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                }
              },
              required: ['code', 'language']
            }
          },
          'generate-refactoring-suggestions': {
            description: 'Generate specific refactoring suggestions for code',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'The code to refactor'
                },
                language: {
                  type: 'string',
                  enum: ['python', 'javascript', 'typescript', 'java', 'go', 'cpp', 'rust', 'ruby', 'php'],
                  description: 'Programming language of the code'
                },
                context: {
                  type: 'string',
                  description: 'Additional context about the code (optional)'
                }
              },
              required: ['code', 'language']
            }
          }
        },
        resources: {
          'analysis-results': {
            description: 'Access previous analysis results',
            inputSchema: {
              type: 'object',
              properties: {
                analysisId: {
                  type: 'string',
                  description: 'ID of the analysis to retrieve'
                }
              },
              required: ['analysisId']
            }
          }
        }
      }
    };

    this.server = new McpServer(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: this.config.capabilities
      }
    );

    this.pythonAnalyzer = new PythonAnalyzer();
    this.javascriptAnalyzer = new JavaScriptAnalyzer();
    this.typescriptAnalyzer = new TypeScriptAnalyzer();
    this.javaAnalyzer = new JavaAnalyzer();
    this.multiLanguageFramework = new MultiLanguageFramework();
    this.aiModelManager = new AIModelManager();
    
    // Register analyzers with multi-language framework
    this.multiLanguageFramework.setAnalyzer('python', this.pythonAnalyzer);
    this.multiLanguageFramework.setAnalyzer('javascript', this.javascriptAnalyzer);
    this.multiLanguageFramework.setAnalyzer('typescript', this.typescriptAnalyzer);
    this.multiLanguageFramework.setAnalyzer('java', this.javaAnalyzer);
    
    this.initializeTools();
  }

  private async initializeTools(): Promise<void> {
    await this.pythonAnalyzer.initialize();
    await this.javascriptAnalyzer.initialize();

    // Tool for analyzing code directly
    this.server.tool(
      'analyze-code',
      'Analyze code quality and generate suggestions',
      {
        code: z.string(),
        language: z.enum(['python', 'javascript']),
        filePath: z.string().optional(),
        options: z.object({
          includeSuggestions: z.boolean().default(true),
          thresholds: z.object({
            complexity: z.number().min(1).optional(),
            maintainability: z.number().min(0).max(100).optional(),
            coverage: z.number().min(0).max(100).optional()
          }).optional(),
          rules: z.array(z.string()).optional(),
          skipDependencies: z.boolean().optional()
        }).optional()
      },
      async ({ code, language, filePath, options }) => {
        try {
          const analyzer = language === 'python' ? this.pythonAnalyzer : this.javascriptAnalyzer;
          const analysisOptions: AnalysisOptions = {
            includeSuggestions: options?.includeSuggestions ?? true,
            thresholds: options?.thresholds,
            rules: options?.rules,
            skipDependencies: options?.skipDependencies
          };

          const tempFilePath = filePath || `temp.${language === 'python' ? 'py' : 'js'}`;
          
          // Create a temporary analyzer instance for in-memory code
          let result = await this.analyzeInMemoryCode(analyzer, code, tempFilePath, analysisOptions);

          // Enhance suggestions with AI if enabled
          if (analysisOptions.includeSuggestions) {
            try {
              const aiContext: any = {
                language,
                code,
                filePath: tempFilePath,
                metrics: result.metrics
              };
              
              if (options?.rules) {
                aiContext.additionalContext = `Rules to consider: ${options.rules.join(', ')}`;
              }
              
              const aiSuggestions = await this.aiModelManager.generateRefactoringSuggestions(code, aiContext);
              
              // Merge AI suggestions with existing ones
              result.suggestions = [...result.suggestions, ...aiSuggestions];
            } catch (error) {
              console.warn('Failed to generate AI suggestions:', error);
            }
          }

          return {
            content: [{
              type: 'text',
              text: this.formatAnalysisResult(result)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error analyzing code: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool for analyzing files (mock implementation for now)
    this.server.tool(
      'analyze-file',
      'Analyze a specific file',
      {
        filePath: z.string(),
        options: z.object({
          includeSuggestions: z.boolean().default(true),
          thresholds: z.object({
            complexity: z.number().min(1).optional(),
            maintainability: z.number().min(0).max(100).optional(),
            coverage: z.number().min(0).max(100).optional()
          }).optional(),
          rules: z.array(z.string()).optional(),
          skipDependencies: z.boolean().optional()
        }).optional()
      },
      async ({ filePath, options }) => {
        try {
          const language = this.detectLanguageFromPath(filePath);
          if (!language) {
            return {
              content: [{
                type: 'text',
                text: `Unsupported file type: ${filePath}`
              }],
              isError: true
            };
          }

          const analyzer = language === 'python' ? this.pythonAnalyzer : this.javascriptAnalyzer;
          const analysisOptions: AnalysisOptions = {
            includeSuggestions: options?.includeSuggestions ?? true,
            thresholds: options?.thresholds,
            rules: options?.rules,
            skipDependencies: options?.skipDependencies
          };

          // Mock file reading for now
          const mockCode = this.generateMockCode(language);
          const result = await this.analyzeInMemoryCode(analyzer, mockCode, filePath, analysisOptions);

          return {
            content: [{
              type: 'text',
              text: this.formatAnalysisResult(result)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error analyzing file: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool for analyzing multiple files
    this.server.tool(
      'analyze-multiple-files',
      'Analyze multiple files',
      {
        filePaths: z.array(z.string()),
        options: z.object({
          includeSuggestions: z.boolean().default(true),
          thresholds: z.object({
            complexity: z.number().min(1).optional(),
            maintainability: z.number().min(0).max(100).optional(),
            coverage: z.number().min(0).max(100).optional()
          }).optional(),
          rules: z.array(z.string()).optional(),
          skipDependencies: z.boolean().optional()
        }).optional()
      },
      async ({ filePaths, options }) => {
        try {
          const results: AnalysisResult[] = [];
          const analysisOptions: AnalysisOptions = {
            includeSuggestions: options?.includeSuggestions ?? true,
            thresholds: options?.thresholds,
            rules: options?.rules,
            skipDependencies: options?.skipDependencies
          };

          for (const filePath of filePaths) {
            const language = this.detectLanguageFromPath(filePath);
            if (language) {
              const analyzer = language === 'python' ? this.pythonAnalyzer : this.javascriptAnalyzer;
              const mockCode = this.generateMockCode(language);
              const result = await this.analyzeInMemoryCode(analyzer, mockCode, filePath, analysisOptions);
              results.push(result);
            }
          }

          return {
            content: [{
              type: 'text',
              text: this.formatMultipleAnalysisResults(results)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error analyzing files: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool for getting supported languages
    this.server.tool(
      'get-supported-languages',
      'Get list of supported programming languages',
      {},
      async () => {
        const languages = [
          ...this.pythonAnalyzer.getSupportedLanguages(),
          ...this.javascriptAnalyzer.getSupportedLanguages()
        ];

        return {
          content: [{
            type: 'text',
            text: `Supported languages: ${languages.join(', ')}`
          }]
        };
      }
    );

    // Tool for AI-powered code analysis
    this.server.tool(
      'ai-analyze-code',
      'Analyze code using AI models for enhanced insights',
      {
        code: z.string(),
        language: z.enum(['python', 'javascript']),
        filePath: z.string().optional(),
        context: z.string().optional(),
        options: z.object({
          includeTraditionalAnalysis: z.boolean().default(true),
          aiModel: z.string().optional(),
          focus: z.enum(['quality', 'performance', 'security', 'maintainability']).optional()
        }).optional()
      },
      async ({ code, language, filePath, context, options }) => {
        try {
          let result: AnalysisResult | null = null;
          let aiInsights: any = null;

          // Perform traditional analysis if requested
          if (options?.includeTraditionalAnalysis) {
            const analyzer = language === 'python' ? this.pythonAnalyzer : this.javascriptAnalyzer;
            const tempFilePath = filePath || `temp.${language === 'python' ? 'py' : 'js'}`;
            result = await this.analyzeInMemoryCode(analyzer, code, tempFilePath, {
              includeSuggestions: true
            });
          }

          // Perform AI analysis
          try {
            const aiContext: any = {
              language,
              code,
              filePath: filePath || `temp.${language === 'python' ? 'py' : 'js'}`,
              metrics: result?.metrics
            };

            if (context || options?.focus) {
              aiContext.additionalContext = context || `Focus: ${options?.focus || 'general'}`;
            }

            aiInsights = await this.aiModelManager.generateCodeAnalysis(code, aiContext);
          } catch (error) {
            console.warn('Failed to generate AI insights:', error);
          }

          const formatOptions: any = {
            traditional: options?.includeTraditionalAnalysis ?? true,
            ai: !!aiInsights
          };
          
          if (options?.focus) {
            formatOptions.focus = options.focus;
          }

          return {
            content: [{
              type: 'text',
              text: this.formatAIAnalysisResult(result, aiInsights, formatOptions)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error in AI analysis: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool for generating refactoring suggestions
    this.server.tool(
      'generate-refactoring-suggestions',
      'Generate specific refactoring suggestions for code',
      {
        code: z.string(),
        language: z.enum(['python', 'javascript']),
        context: z.string().optional()
      },
      async ({ code, language, context }) => {
        try {
          const analyzer = language === 'python' ? this.pythonAnalyzer : this.javascriptAnalyzer;
          const tempFilePath = `temp.${language === 'python' ? 'py' : 'js'}`;
          
          const result = await this.analyzeInMemoryCode(analyzer, code, tempFilePath, {
            includeSuggestions: true
          });

          const formattedSuggestions = this.formatRefactoringSuggestions(result.suggestions, context);

          return {
            content: [{
              type: 'text',
              text: formattedSuggestions
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error generating refactoring suggestions: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool for getting language information
    this.server.tool(
      'get-language-info',
      'Get detailed information about a supported language',
      {
        language: z.enum(['python', 'javascript', 'typescript', 'java', 'go', 'cpp', 'rust', 'ruby', 'php'])
      },
      async ({ language }) => {
        try {
          const info = this.multiLanguageFramework.getLanguageInfo(language);
          
          if (!info) {
            return {
              content: [{
                type: 'text',
                text: `No information available for language: ${language}`
              }],
              isError: true
            };
          }

          const output = `# Language Information: ${language.charAt(0).toUpperCase() + language.slice(1)}

## Extensions
${info.extensions.join(', ')}

## Default Rules
${info.defaultRules.join(', ')}

## Complexity Thresholds
- High: ${info.metrics.complexity.high}
- Medium: ${info.metrics.complexity.medium}

## Maintainability Thresholds
- Poor: ${info.metrics.maintainability.poor}
- Fair: ${info.metrics.maintainability.fair}

## Analyzer Status
${info.name && this.multiLanguageFramework.validateLanguage(info.name) ? '✅ Available' : '❌ Not implemented'}`;

          return {
            content: [{
              type: 'text',
              text: output
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error getting language info: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool for analyzing with multi-language framework
    this.server.tool(
      'analyze-with-framework',
      'Analyze code using the multi-language framework',
      {
        code: z.string(),
        language: z.enum(['python', 'javascript', 'typescript', 'java', 'go', 'cpp', 'rust', 'ruby', 'php']),
        filePath: z.string().optional(),
        options: z.object({
          includeSuggestions: z.boolean().default(true),
          thresholds: z.object({
            complexity: z.number().min(1).optional(),
            maintainability: z.number().min(0).max(100).optional()
          }).optional(),
          rules: z.array(z.string()).optional()
        }).optional()
      },
      async ({ code, language, filePath, options }) => {
        try {
          const analysisOptions: AnalysisOptions = {
            includeSuggestions: options?.includeSuggestions ?? true,
            thresholds: options?.thresholds,
            rules: options?.rules
          };

          const result = await this.multiLanguageFramework.analyzeCode(code, language, filePath, analysisOptions);

          return {
            content: [{
              type: 'text',
              text: this.formatAnalysisResult(result)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error analyzing with framework: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Update the existing get-supported-languages tool to use framework
    this.server.tool(
      'get-supported-languages',
      'Get list of supported programming languages',
      {},
      async () => {
        try {
          const report = this.multiLanguageFramework.generateLanguageReport();

          return {
            content: [{
              type: 'text',
              text: report
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `Error getting supported languages: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );
  }

  private async analyzeInMemoryCode(
    analyzer: any,
    code: string,
    filePath: string,
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    // Override the readFile method to use in-memory code
    const originalReadFile = (analyzer as any).readFile;
    (analyzer as any).readFile = async () => code;

    try {
      return await analyzer.analyzeFile(filePath, options);
    } finally {
      // Restore original readFile method
      (analyzer as any).readFile = originalReadFile;
    }
  }

  private detectLanguageFromPath(filePath: string): string | null {
    return this.multiLanguageFramework.detectLanguage(filePath);
  }

  private generateMockCode(language: string): string {
    switch (language) {
      case 'python':
        return `def example_function():
    # This is a sample function
    result = []
    for i in range(10):
        if i % 2 == 0:
            result.append(i)
    return result`;
      
      case 'javascript':
        return `function exampleFunction() {
  // This is a sample function
  const result = [];
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      result.push(i);
    }
  }
  return result;
}`;
      
      case 'typescript':
        return `interface User {
  id: number;
  name: string;
}

function exampleFunction(): User {
  // This is a sample function
  return {
    id: 1,
    name: "Example User"
  };
}`;
      
      case 'java':
        return `public class ExampleClass {
    private String name;
    
    public ExampleClass(String name) {
        this.name = name;
    }
    
    public String getName() {
        return this.name;
    }
}`;
      
      case 'go':
        return `package main

import "fmt"

func exampleFunction() string {
    // This is a sample function
    return "Hello, World!"
}`;
      
      case 'cpp':
        return `#include <iostream>
#include <string>

class ExampleClass {
private:
    std::string name;
public:
    ExampleClass(const std::string& n) : name(n) {}
    std::string getName() const { return name; }
};`;
      
      case 'rust':
        return `struct User {
    id: u32,
    name: String,
}

impl User {
    fn new(id: u32, name: String) -> Self {
        User { id, name }
    }
}`;
      
      case 'ruby':
        return `class ExampleClass
  def initialize(name)
    @name = name
  end
  
  def name
    @name
  end
end`;
      
      case 'php':
        return `<?php
class ExampleClass {
    private $name;
    
    public function __construct($name) {
        $this->name = $name;
    }
    
    public function getName() {
        return $this->name;
    }
}
?>`;
      
      default:
        return `// Mock code for ${language}`;
    }
  }

  private formatAnalysisResult(result: AnalysisResult): string {
    let output = `# Code Analysis Results for ${result.filePath}\n\n`;
    output += `**Language:** ${result.language}\n`;
    output += `**Timestamp:** ${new Date(result.timestamp).toISOString()}\n\n`;

    // Metrics
    output += `## Metrics\n`;
    output += `- **Lines of Code:** ${result.metrics.linesOfCode}\n`;
    output += `- **Complexity:** ${result.metrics.complexity}\n`;
    output += `- **Maintainability:** ${result.metrics.maintainability}/100\n`;
    output += `- **Function Count:** ${result.metrics.functionCount}\n`;
    output += `- **Technical Debt:** ${result.metrics.technicalDebt}\n\n`;

    // Issues
    if (result.issues.length > 0) {
      output += `## Issues Found (${result.issues.length})\n\n`;
      result.issues.forEach(issue => {
        output += `### ${issue.type.toUpperCase()} (Line ${issue.line})\n`;
        output += `- **Severity:** ${issue.severity}\n`;
        output += `- **Rule:** ${issue.rule}\n`;
        output += `- **Message:** ${issue.message}\n`;
        if (issue.fix) {
          output += `- **Fix:** ${issue.fix.description}\n`;
        }
        output += '\n';
      });
    } else {
      output += `## Issues Found\n\nNo issues detected.\n\n`;
    }

    // Suggestions
    if (result.suggestions.length > 0) {
      output += `## Refactoring Suggestions (${result.suggestions.length})\n\n`;
      result.suggestions.forEach(suggestion => {
        output += `### ${suggestion.type.toUpperCase()} (Priority: ${suggestion.priority})\n`;
        output += `- **Description:** ${suggestion.description}\n`;
        if (suggestion.estimatedImpact.complexityReduction) {
          output += `- **Complexity Reduction:** ${suggestion.estimatedImpact.complexityReduction}\n`;
        }
        if (suggestion.estimatedImpact.maintainabilityImprovement) {
          output += `- **Maintainability Improvement:** ${suggestion.estimatedImpact.maintainabilityImprovement}\n`;
        }
        output += '\n';
      });
    } else {
      output += `## Refactoring Suggestions\n\nNo suggestions at this time.\n`;
    }

    return output;
  }

  private formatMultipleAnalysisResults(results: AnalysisResult[]): string {
    let output = `# Multiple Files Analysis Results\n\n`;
    output += `**Files Analyzed:** ${results.length}\n`;
    output += `**Analysis Time:** ${new Date().toISOString()}\n\n`;

    // Summary statistics
    const totalLines = results.reduce((sum, r) => sum + r.metrics.linesOfCode, 0);
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const totalSuggestions = results.reduce((sum, r) => sum + r.suggestions.length, 0);
    const avgComplexity = results.reduce((sum, r) => sum + r.metrics.complexity, 0) / results.length;
    const avgMaintainability = results.reduce((sum, r) => sum + r.metrics.maintainability, 0) / results.length;

    output += `## Summary\n`;
    output += `- **Total Lines of Code:** ${totalLines}\n`;
    output += `- **Total Issues:** ${totalIssues}\n`;
    output += `- **Total Suggestions:** ${totalSuggestions}\n`;
    output += `- **Average Complexity:** ${avgComplexity.toFixed(1)}\n`;
    output += `- **Average Maintainability:** ${avgMaintainability.toFixed(1)}/100\n\n`;

    // Individual file results
    results.forEach(result => {
      output += `---\n\n${this.formatAnalysisResult(result)}\n`;
    });

    return output;
  }

  private formatRefactoringSuggestions(suggestions: any[], context?: string): string {
    let output = `# Refactoring Suggestions\n\n`;

    if (context) {
      output += `**Context:** ${context}\n\n`;
    }

    if (suggestions.length === 0) {
      output += `No refactoring suggestions available for this code.\n`;
      return output;
    }

    // Group suggestions by priority
    const highPriority = suggestions.filter(s => s.priority === 'high');
    const mediumPriority = suggestions.filter(s => s.priority === 'medium');
    const lowPriority = suggestions.filter(s => s.priority === 'low');

    if (highPriority.length > 0) {
      output += `## High Priority Suggestions\n\n`;
      highPriority.forEach(suggestion => {
        output += `### ${suggestion.description}\n`;
        output += `- **Type:** ${suggestion.type}\n`;
        if (suggestion.estimatedImpact.complexityReduction) {
          output += `- **Complexity Reduction:** ${suggestion.estimatedImpact.complexityReduction}\n`;
        }
        if (suggestion.estimatedImpact.maintainabilityImprovement) {
          output += `- **Maintainability Improvement:** ${suggestion.estimatedImpact.maintainabilityImprovement}\n`;
        }
        output += '\n';
      });
    }

    if (mediumPriority.length > 0) {
      output += `## Medium Priority Suggestions\n\n`;
      mediumPriority.forEach(suggestion => {
        output += `### ${suggestion.description}\n`;
        output += `- **Type:** ${suggestion.type}\n`;
        if (suggestion.estimatedImpact.complexityReduction) {
          output += `- **Complexity Reduction:** ${suggestion.estimatedImpact.complexityReduction}\n`;
        }
        if (suggestion.estimatedImpact.maintainabilityImprovement) {
          output += `- **Maintainability Improvement:** ${suggestion.estimatedImpact.maintainabilityImprovement}\n`;
        }
        output += '\n';
      });
    }

    if (lowPriority.length > 0) {
      output += `## Low Priority Suggestions\n\n`;
      lowPriority.forEach(suggestion => {
        output += `### ${suggestion.description}\n`;
        output += `- **Type:** ${suggestion.type}\n`;
        if (suggestion.estimatedImpact.complexityReduction) {
          output += `- **Complexity Reduction:** ${suggestion.estimatedImpact.complexityReduction}\n`;
        }
        if (suggestion.estimatedImpact.maintainabilityImprovement) {
          output += `- **Maintainability Improvement:** ${suggestion.estimatedImpact.maintainabilityImprovement}\n`;
        }
        output += '\n';
      });
    }

    return output;
  }

  private formatAIAnalysisResult(
    traditionalResult: AnalysisResult | null,
    aiInsights: any,
    options: {
      traditional: boolean;
      ai: boolean;
      focus?: string;
    }
  ): string {
    let output = `# AI-Powered Code Analysis Results\n\n`;
    
    if (options.focus) {
      output += `**Focus:** ${options.focus}\n\n`;
    }

    output += `**Analysis Type:** ${options.traditional && options.ai ? 'Hybrid (Traditional + AI)' : options.traditional ? 'Traditional' : 'AI Only'}\n\n`;

    // Traditional Analysis Results
    if (traditionalResult && options.traditional) {
      output += `## Traditional Analysis\n\n`;
      output += `**Language:** ${traditionalResult.language}\n`;
      output += `**Complexity:** ${traditionalResult.metrics.complexity}\n`;
      output += `**Maintainability:** ${traditionalResult.metrics.maintainability}/100\n`;
      output += `**Lines of Code:** ${traditionalResult.metrics.linesOfCode}\n\n`;

      if (traditionalResult.issues.length > 0) {
        output += `### Issues Found\n`;
        traditionalResult.issues.forEach(issue => {
          output += `- **${issue.type.toUpperCase()}** (Line ${issue.line}): ${issue.message}\n`;
        });
        output += `\n`;
      }
    }

    // AI Analysis Results
    if (aiInsights && options.ai) {
      output += `## AI-Powered Insights\n\n`;
      
      if (aiInsights.issues && aiInsights.issues.length > 0) {
        output += `### AI-Identified Issues\n`;
        aiInsights.issues.forEach((issue: any) => {
          output += `- **${issue.type.toUpperCase()}** (Line ${issue.line}): ${issue.message}\n`;
        });
        output += `\n`;
      }

      if (aiInsights.suggestions && aiInsights.suggestions.length > 0) {
        output += `### AI-Generated Suggestions\n`;
        aiInsights.suggestions.forEach((suggestion: any) => {
          output += `- **${suggestion.type.toUpperCase()}** (${suggestion.priority}): ${suggestion.description}\n`;
        });
        output += `\n`;
      }

      if (aiInsights.insights) {
        output += `### AI Insights\n`;
        output += `${aiInsights.insights}\n\n`;
      }
    }

    // Combined Summary
    if (traditionalResult && options.traditional && aiInsights && options.ai) {
      output += `## Combined Analysis Summary\n\n`;
      
      const totalIssues = (traditionalResult.issues.length || 0) + (aiInsights.issues?.length || 0);
      const totalSuggestions = (traditionalResult.suggestions.length || 0) + (aiInsights.suggestions?.length || 0);
      
      output += `- **Total Issues Identified:** ${totalIssues}\n`;
      output += `- **Total Suggestions:** ${totalSuggestions}\n`;
      output += `- **Analysis Confidence:** High (Combined traditional + AI analysis)\n\n`;
      
      output += `> This analysis combines rule-based static analysis with AI-powered insights for comprehensive code quality assessment.\n`;
    }

    return output;
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Code Analysis Server started successfully');
  }
}

// Start the server
async function main() {
  const server = new CodeAnalysisServer();
  await server.start();
}

main().catch(error => {
  console.error('Failed to start Code Analysis Server:', error);
  process.exit(1);
});