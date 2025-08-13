import { BaseCodeAnalyzer, AnalysisResult, AnalysisIssue, CodeMetrics, RefactoringSuggestion, AnalysisOptions } from './BaseCodeAnalyzer';

export class PythonAnalyzer extends BaseCodeAnalyzer {
  constructor(options?: AnalysisOptions) {
    super(options);
  }

  async initialize(): Promise<void> {
    // Register Python language support
    this.registerLanguage({
      name: 'python',
      extensions: ['py'],
      analyze: this.analyzePythonCode.bind(this),
    });
  }

  private async analyzePythonCode(
    code: string, 
    filePath: string, 
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    const issues: AnalysisIssue[] = [];
    const suggestions: RefactoringSuggestion[] = [];
    
    // Basic Python-specific analysis
    const lines = code.split('\n');
    let complexity = this.calculatePythonComplexity(code);
    const metrics = this.calculatePythonMetrics(code, complexity);

    // Check for Python-specific issues
    issues.push(...this.checkPythonStyle(code, lines));
    issues.push(...this.checkPythonComplexity(code, lines, complexity, options));
    issues.push(...this.checkPythonBestPractices(code, lines));

    // Generate Python-specific suggestions
    if (options.includeSuggestions) {
      suggestions.push(...this.generatePythonSuggestions(code, lines, metrics));
    }

    return {
      filePath,
      language: 'python',
      issues,
      metrics,
      suggestions,
      timestamp: Date.now(),
    };
  }

  private calculatePythonComplexity(code: string): number {
    const lines = code.split('\n');
    let complexity = 1; // Base complexity

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Python-specific complexity factors
      if (trimmed.startsWith('if ') || trimmed.startsWith('elif ')) complexity++;
      if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) complexity++;
      if (trimmed.startsWith('try:')) complexity++;
      if (trimmed.startsWith('except ')) complexity++;
      if (trimmed.startsWith('elif ')) complexity++;
      if (trimmed.includes(' and ') || trimmed.includes(' or ')) complexity++;
      if (trimmed.startsWith('def ') && trimmed.includes('lambda')) complexity += 2;
    }

    return complexity;
  }

  private calculatePythonMetrics(code: string, complexity: number): CodeMetrics {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    const commentLines = lines.filter(line => line.trim().startsWith('#'));
    const functionMatches = code.match(/^def\s+\w+/gm) || [];
    const classMatches = code.match(/^class\s+\w+/gm) || [];

    const linesOfCode = nonEmptyLines.length;
    const commentPercentage = linesOfCode > 0 ? (commentLines.length / linesOfCode) * 100 : 0;
    const functionCount = functionMatches.length + classMatches.length;
    const averageFunctionLength = functionCount > 0 ? linesOfCode / functionCount : 0;

    // Python-specific dependencies (simple import detection)
    const dependencies = this.extractPythonDependencies(code);

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

  private extractPythonDependencies(code: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)/gm;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      if (match[1]) {
        dependencies.push(match[1]);
      } else {
        match[2].split(',').forEach(imp => {
          dependencies.push(imp.trim().split('.')[0]);
        });
      }
    }

    return [...new Set(dependencies)];
  }

  private checkPythonStyle(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      // Check for line length (PEP 8)
      if (line.length > 79) {
        issues.push({
          type: 'warning',
          severity: 'low',
          message: `Line too long (${line.length} > 79 characters)`,
          line: lineNumber,
          rule: 'PEP8-E501',
        });
      }

      // Check for missing docstrings
      if (trimmed.startsWith('def ') && !lines[index + 1]?.trim().startsWith('"""')) {
        issues.push({
          type: 'warning',
          severity: 'medium',
          message: 'Missing docstring for function',
          line: lineNumber,
          rule: 'PEP257-D100',
        });
      }

      // Check for wildcard imports
      if (trimmed.startsWith('import *')) {
        issues.push({
          type: 'warning',
          severity: 'medium',
          message: 'Avoid wildcard imports',
          line: lineNumber,
          rule: 'PEP8-F401',
        });
      }
    });

    return issues;
  }

  private checkPythonComplexity(
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

  private checkPythonBestPractices(_code: string, lines: string[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      // Check for bare except
      if (trimmed === 'except:') {
        issues.push({
          type: 'error',
          severity: 'high',
          message: 'Bare except clause should specify exception type',
          line: lineNumber,
          rule: 'PYTHON-W0702',
        });
      }

      // Check for mutable default arguments
      if (trimmed.includes('= []') || trimmed.includes('= {}')) {
        issues.push({
          type: 'warning',
          severity: 'high',
          message: 'Mutable default argument detected',
          line: lineNumber,
          rule: 'PYTHON-W0102',
        });
      }

      // Check for print statements in production code
      if (trimmed.startsWith('print(') && !_code.includes('if __name__ == "__main__":')) {
        issues.push({
          type: 'warning',
          severity: 'low',
          message: 'Debug print statement found',
          line: lineNumber,
          rule: 'PYTHON-W0012',
        });
      }
    });

    return issues;
  }

  private generatePythonSuggestions(
    code: string, 
    _lines: string[], 
    metrics: CodeMetrics
  ): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    // Suggest list comprehensions
    const forLoops = code.match(/\s+for\s+\w+\s+in\s+.+:\s*\n\s+\..+=\s+.+/g) || [];
    if (forLoops.length > 0) {
      suggestions.push({
        type: 'restructure',
        priority: 'medium',
        description: 'Consider using list comprehensions for better readability',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 10,
        },
      });
    }

    // Suggest type hints if missing
    const hasTypeHints = code.includes(': ') && code.includes('->');
    if (!hasTypeHints && metrics.functionCount > 0) {
      suggestions.push({
        type: 'optimize',
        priority: 'low',
        description: 'Add type hints for better code documentation and IDE support',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 15,
        },
      });
    }

    // Suggest context managers for resource management
    const openCalls = code.match(/open\(/g) || [];
    const withStatements = code.match(/with\s+open\(/g) || [];
    if (openCalls.length > withStatements.length) {
      suggestions.push({
        type: 'restructure',
        priority: 'high',
        description: 'Use context managers (with statement) for file operations',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 20,
        },
      });
    }

    return suggestions;
  }
}