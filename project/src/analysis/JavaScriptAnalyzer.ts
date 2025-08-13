import { BaseCodeAnalyzer, AnalysisResult, AnalysisIssue, CodeMetrics, RefactoringSuggestion, AnalysisOptions } from './BaseCodeAnalyzer';

export class JavaScriptAnalyzer extends BaseCodeAnalyzer {
  constructor(options?: AnalysisOptions) {
    super(options);
  }

  async initialize(): Promise<void> {
    // Register JavaScript language support
    this.registerLanguage({
      name: 'javascript',
      extensions: ['js', 'jsx', 'ts', 'tsx'],
      analyze: this.analyzeJavaScriptCode.bind(this),
    });
  }

  private async analyzeJavaScriptCode(
    code: string, 
    filePath: string, 
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    const issues: AnalysisIssue[] = [];
    const suggestions: RefactoringSuggestion[] = [];
    
    // Basic JavaScript-specific analysis
    const lines = code.split('\n');
    let complexity = this.calculateJavaScriptComplexity(code);
    const metrics = this.calculateJavaScriptMetrics(code, complexity);

    // Check for JavaScript-specific issues
    issues.push(...this.checkJavaScriptStyle(code, lines));
    issues.push(...this.checkJavaScriptComplexity(code, lines, complexity, options));
    issues.push(...this.checkJavaScriptBestPractices(code, lines));

    // Generate JavaScript-specific suggestions
    if (options.includeSuggestions) {
      suggestions.push(...this.generateJavaScriptSuggestions(code, lines, metrics));
    }

    return {
      filePath,
      language: 'javascript',
      issues,
      metrics,
      suggestions,
      timestamp: Date.now(),
    };
  }

  private calculateJavaScriptComplexity(code: string): number {
    const lines = code.split('\n');
    let complexity = 1; // Base complexity

    for (const line of lines) {
      const trimmed = line.trim();
      
      // JavaScript-specific complexity factors
      if (trimmed.startsWith('if ') || trimmed.startsWith('else if') || trimmed.startsWith('if(')) complexity++;
      if (trimmed.startsWith('for ') || trimmed.startsWith('for(') || trimmed.startsWith('while ') || trimmed.startsWith('while(')) complexity++;
      if (trimmed.startsWith('try {') || trimmed.startsWith('try{')) complexity++;
      if (trimmed.startsWith('catch ') || trimmed.startsWith('catch(')) complexity++;
      if (trimmed.startsWith('switch (') || trimmed.startsWith('switch(')) complexity++;
      if (trimmed.startsWith('case ')) complexity++;
      if (trimmed.includes(' && ') || trimmed.includes(' || ')) complexity++;
      if (trimmed.includes('?.') || trimmed.includes('??')) complexity++;
      if (trimmed.includes('await ')) complexity++;
      if (trimmed.startsWith('function(') || trimmed.includes('function =>')) complexity += 2;
      if (trimmed.includes('else ')) complexity++;
    }

    return complexity;
  }

  private calculateJavaScriptMetrics(code: string, complexity: number): CodeMetrics {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    const commentLines = lines.filter(line => line.trim().startsWith('//') || line.trim().startsWith('/*'));
    const functionMatches = code.match(/function\s+\w+|\w+\s*[:=]\s*\(.*\)\s*=>/g) || [];
    const classMatches = code.match(/class\s+\w+/g) || [];

    const linesOfCode = nonEmptyLines.length;
    const commentPercentage = linesOfCode > 0 ? (commentLines.length / linesOfCode) * 100 : 0;
    const functionCount = functionMatches.length + classMatches.length;
    const averageFunctionLength = functionCount > 0 ? linesOfCode / functionCount : 0;

    // JavaScript-specific dependencies
    const dependencies = this.extractJavaScriptDependencies(code);

    return {
      complexity,
      maintainability: this.calculateMaintainability({
        complexity,
        maintainability: 0,
        linesOfCode,
        commentLines: commentLines.length,
        commentPercentage,
        functionCount,
        averageFunctionLength,
        dependencies,
        technicalDebt: 0,
      }),
      linesOfCode,
      commentLines: commentLines.length,
      commentPercentage,
      functionCount,
      averageFunctionLength,
      dependencies,
      technicalDebt: this.calculateTechnicalDebt({
        complexity,
        maintainability: 0,
        linesOfCode,
        commentLines: commentLines.length,
        commentPercentage,
        functionCount,
        averageFunctionLength,
        dependencies,
        technicalDebt: 0,
      }),
    };
  }

  private extractJavaScriptDependencies(code: string): string[] {
    const dependencies: string[] = [];
    
    // ES6 imports
    const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      const module = match[1];
      if (!module.startsWith('.') && !module.startsWith('/')) {
        dependencies.push(module.split('/')[0]);
      }
    }

    // CommonJS require
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    while ((match = requireRegex.exec(code)) !== null) {
      const module = match[1];
      if (!module.startsWith('.') && !module.startsWith('/')) {
        dependencies.push(module.split('/')[0]);
      }
    }

    return [...new Set(dependencies)];
  }

  private checkJavaScriptStyle(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      // Check for line length
      if (line.length > 100) {
        issues.push({
          type: 'warning',
          severity: 'low',
          message: `Line too long (${line.length} > 100 characters)`,
          line: lineNumber,
          rule: 'ESLINT-MAX-LINE-LENGTH',
        });
      }

      // Check for missing semicolons (basic detection)
      if (trimmed.length > 0 && 
          !trimmed.endsWith(';') && 
          !trimmed.endsWith('{') && 
          !trimmed.endsWith('}') && 
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('/*') &&
          !trimmed.startsWith('if') &&
          !trimmed.startsWith('for') &&
          !trimmed.startsWith('while') &&
          !trimmed.startsWith('function') &&
          !trimmed.startsWith('class') &&
          !trimmed.startsWith('return') &&
          !trimmed.startsWith('break') &&
          !trimmed.startsWith('continue') &&
          !trimmed.includes('=>') &&
          !trimmed.includes('${')) {
        issues.push({
          type: 'warning',
          severity: 'low',
          message: 'Missing semicolon',
          line: lineNumber,
          rule: 'ESLINT-SEMI',
        });
      }

      // Check for var usage
      if (trimmed.includes('var ')) {
        issues.push({
          type: 'warning',
          severity: 'medium',
          message: 'Use let or const instead of var',
          line: lineNumber,
          rule: 'ESLINT-VAR',
        });
      }

      // Check for double equals
      if (trimmed.includes('==') && !trimmed.includes('===') && !trimmed.includes('!=')) {
        issues.push({
          type: 'warning',
          severity: 'medium',
          message: 'Use === instead of == for strict equality',
          line: lineNumber,
          rule: 'ESLINT-EQEQEQ',
        });
      }
    });

    return issues;
  }

  private checkJavaScriptComplexity(
    _code: string, 
    _lines: string[], 
    complexity: number, 
    options: AnalysisOptions
  ): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    const threshold = options.thresholds?.complexity || 10;

    if (complexity > threshold) {
      issues.push({
        type: 'warning',
        severity: complexity > threshold * 2 ? 'high' : 'medium',
        message: `Function complexity too high (${complexity} > ${threshold})`,
        line: 1,
        rule: 'COMPLEXITY-HIGH',
        fix: {
          description: 'Consider breaking down complex function into smaller functions',
          replacement: 'Extract complex logic into separate functions',
        },
      });
    }

    return issues;
  }

  private checkJavaScriptBestPractices(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      // Check for console.log in production code
      if (trimmed.includes('console.log') || trimmed.includes('console.error') || trimmed.includes('console.warn')) {
        issues.push({
          type: 'warning',
          severity: 'low',
          message: 'Console statement found in production code',
          line: lineNumber,
          rule: 'ESLINT-NO-CONSOLE',
        });
      }

      // Check for eval usage
      if (trimmed.includes('eval(')) {
        issues.push({
          type: 'error',
          severity: 'high',
          message: 'eval() usage is dangerous and should be avoided',
          line: lineNumber,
          rule: 'ESLINT-NO-EVAL',
        });
      }

      // Check for unused variables (basic detection)
      if (trimmed.match(/(?:let|const|var)\s+\w+/) && !trimmed.includes('=') && !trimmed.endsWith(',')) {
        const varMatch = trimmed.match(/(?:let|const|var)\s+(\w+)/);
        if (varMatch) {
          const varName = varMatch[1];
          // Simple check - in real implementation would need full AST parsing
          if (!_code.includes(`${varName}=`) && !_code.includes(`${varName}.`) && !_code.includes(`${varName}[`)) {
            issues.push({
              type: 'warning',
              severity: 'medium',
              message: `Variable '${varName}' appears to be unused`,
              line: lineNumber,
              rule: 'ESLINT-NO-UNUSED-VARS',
            });
          }
        }
      }

      // Check for nested ternary operators
      if (trimmed.includes('?') && trimmed.split('?').length > 2) {
        issues.push({
          type: 'warning',
          severity: 'medium',
          message: 'Nested ternary operators reduce readability',
          line: lineNumber,
          rule: 'ESLINT-NESTED-TERNARY',
        });
      }
    });

    return issues;
  }

  private generateJavaScriptSuggestions(
    code: string, 
    _lines: string[], 
    metrics: CodeMetrics
  ): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    // Use metrics to make informed suggestions
    if (metrics.complexity > 15) {
      suggestions.push({
        type: 'restructure',
        priority: 'high',
        description: 'Consider breaking down complex function into smaller functions',
        line: 1,
        estimatedImpact: {
          complexityReduction: metrics.complexity * 0.3,
          maintainabilityImprovement: 20,
        },
      });
    }

    // Suggest async/await for Promise chains
    const promiseChains = (code.match(/\.then\(/g) || []).length;
    if (promiseChains > 1) {
      suggestions.push({
        type: 'restructure',
        priority: 'medium',
        description: 'Consider using async/await instead of Promise chains for better readability',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 15,
        },
      });
    }

    // Suggest destructuring for object property access
    const dotNotations = (code.match(/\w+\.\w+/g) || []).length;
    if (dotNotations > 2) {
      suggestions.push({
        type: 'optimize',
        priority: 'low',
        description: 'Consider using destructuring assignment for cleaner object property access',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 10,
        },
      });
    }

    // Suggest template literals over string concatenation
    const concatenations = (code.match(/\+\s*['"]/g) || []).length;
    if (concatenations > 1) {
      suggestions.push({
        type: 'optimize',
        priority: 'low',
        description: 'Use template literals instead of string concatenation',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 8,
        },
      });
    }

    // Suggest arrow functions for simple callbacks
    const functionKeywords = (code.match(/function\s*\(/g) || []).length;
    if (functionKeywords > 0) {
      suggestions.push({
        type: 'optimize',
        priority: 'low',
        description: 'Consider using arrow functions for simple callbacks',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 5,
        },
      });
    }

    // Suggest array methods for loops
    const forLoops = (code.match(/for\s*\([^)]*\)\s*\{/g) || []).length;
    if (forLoops > 0) {
      suggestions.push({
        type: 'restructure',
        priority: 'medium',
        description: 'Consider using array methods (map, filter, reduce) instead of for loops',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 12,
        },
      });
    }

    return suggestions;
  }
}