import { BaseCodeAnalyzer, AnalysisResult, AnalysisOptions, CodeMetrics, Issue, RefactoringSuggestion } from './BaseCodeAnalyzer';

export abstract class BaseLanguageAnalyzer extends BaseCodeAnalyzer {
  protected language: string;
  protected extensions: string[];
  protected defaultRules: string[];
  protected config: {
    complexity: {
      high: number;
      medium: number;
    };
    maintainability: {
      poor: number;
      fair: number;
    };
  };

  constructor(
    language: string,
    extensions: string[],
    defaultRules: string[],
    config: {
      complexity: { high: number; medium: number };
      maintainability: { poor: number; fair: number };
    }
  ) {
    super();
    this.language = language;
    this.extensions = extensions;
    this.defaultRules = defaultRules;
    this.config = config;
  }

  public getSupportedLanguages(): string[] {
    return [this.language];
  }

  public getDefaultRules(): string[] {
    return [...this.defaultRules];
  }

  protected applyLanguageSpecificThresholds(options: AnalysisOptions): AnalysisOptions {
    return {
      ...options,
      thresholds: {
        complexity: {
          high: this.config.complexity.high,
          medium: this.config.complexity.medium,
          ...options.thresholds?.complexity
        },
        maintainability: {
          poor: this.config.maintainability.poor,
          fair: this.config.maintainability.fair,
          ...options.thresholds?.maintainability
        },
        ...options.thresholds
      },
      rules: options.rules || this.defaultRules
    };
  }

  protected createIssue(
    type: 'error' | 'warning' | 'info',
    severity: 'high' | 'medium' | 'low',
    message: string,
    line: number,
    rule: string,
    fix?: {
      description: string;
      code?: string;
    }
  ): Issue {
    return {
      type,
      severity,
      message,
      line,
      rule,
      fix
    };
  }

  protected createRefactoringSuggestion(
    type: 'restructure' | 'optimize' | 'modernize' | 'document',
    priority: 'high' | 'medium' | 'low',
    description: string,
    line: number,
    estimatedImpact: {
      complexityReduction?: number;
      maintainabilityImprovement?: number;
      performanceImprovement?: number;
    }
  ): RefactoringSuggestion {
    return {
      type,
      priority,
      description,
      line,
      estimatedImpact
    };
  }

  protected abstract calculateComplexity(code: string): number;
  protected abstract calculateMaintainability(metrics: CodeMetrics): number;
  protected abstract analyzeCodeStructure(code: string): {
    functions: Array<{ name: string; line: number; complexity: number }>;
    classes: Array<{ name: string; line: number; methods: number }>;
    imports: string[];
    exports: string[];
  };
  protected abstract checkLanguageSpecificRules(code: string, rules: string[]): Issue[];
  protected abstract generateLanguageSpecificSuggestions(code: string, metrics: CodeMetrics): RefactoringSuggestion[];

  protected parseBasicMetrics(code: string): CodeMetrics {
    const lines = code.split('\n');
    const totalLines = lines.length;
    const commentLines = lines.filter(line => 
      line.trim().startsWith('//') || 
      line.trim().startsWith('#') || 
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*') ||
      line.trim().startsWith('"""') ||
      line.trim().startsWith("'''")
    ).length;

    const structure = this.analyzeCodeStructure(code);
    const complexity = this.calculateComplexity(code);
    const maintainability = this.calculateMaintainability({
      linesOfCode: totalLines,
      complexity,
      maintainability: 0,
      commentLines,
      commentPercentage: totalLines > 0 ? (commentLines / totalLines) * 100 : 0,
      functionCount: structure.functions.length,
      averageFunctionLength: structure.functions.length > 0 
        ? totalLines / structure.functions.length 
        : 0,
      dependencies: structure.imports,
      technicalDebt: 0
    });

    return {
      linesOfCode: totalLines,
      complexity,
      maintainability,
      commentLines,
      commentPercentage: totalLines > 0 ? (commentLines / totalLines) * 100 : 0,
      functionCount: structure.functions.length,
      averageFunctionLength: structure.functions.length > 0 
        ? totalLines / structure.functions.length 
        : 0,
      dependencies: structure.imports,
      technicalDebt: 0
    };
  }

  protected validateCodeStructure(code: string): Issue[] {
    const issues: Issue[] = [];
    const structure = this.analyzeCodeStructure(code);

    // Check for functions with high complexity
    structure.functions.forEach(func => {
      if (func.complexity > this.config.complexity.high) {
        issues.push(this.createIssue(
          'warning',
          'high',
          `Function '${func.name}' has high complexity (${func.complexity})`,
          func.line,
          'COMPLEXITY_HIGH',
          {
            description: 'Consider breaking down the function into smaller, more focused functions'
          }
        ));
      }
    });

    // Check for classes with too many methods
    structure.classes.forEach(cls => {
      if (cls.methods > 10) {
        issues.push(this.createIssue(
          'warning',
          'medium',
          `Class '${cls.name}' has too many methods (${cls.methods})`,
          cls.line,
          'CLASS_TOO_LONG',
          {
            description: 'Consider splitting the class into smaller, more focused classes'
          }
        ));
      }
    });

    return issues;
  }

  public async analyzeFile(filePath: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const languageOptions = this.applyLanguageSpecificThresholds(options);
    const code = await this.readFile(filePath);

    const metrics = this.parseBasicMetrics(code);
    const structureIssues = this.validateCodeStructure(code);
    const ruleIssues = this.checkLanguageSpecificRules(code, languageOptions.rules || []);
    const suggestions = this.generateLanguageSpecificSuggestions(code, metrics);

    const allIssues = [...structureIssues, ...ruleIssues];

    // Apply thresholds
    const filteredIssues = allIssues.filter(issue => {
      if (languageOptions.thresholds?.complexity) {
        if (issue.rule === 'COMPLEXITY_HIGH' && issue.severity === 'high') {
          return metrics.complexity > languageOptions.thresholds.complexity.high;
        }
      }
      return true;
    });

    return {
      filePath,
      language: this.language,
      issues: filteredIssues,
      metrics,
      suggestions: languageOptions.includeSuggestions ? suggestions : [],
      timestamp: Date.now()
    };
  }

  protected abstract readFile(filePath: string): Promise<string>;

  // Utility methods for common patterns
  protected extractFunctions(code: string, pattern: RegExp): Array<{ name: string; line: number; complexity: number }> {
    const functions: Array<{ name: string; line: number; complexity: number }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const match = line.match(pattern);
      if (match) {
        functions.push({
          name: match[1] || 'anonymous',
          line: index + 1,
          complexity: this.estimateFunctionComplexity(line)
        });
      }
    });

    return functions;
  }

  protected extractClasses(code: string, pattern: RegExp): Array<{ name: string; line: number; methods: number }> {
    const classes: Array<{ name: string; line: number; methods: number }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const match = line.match(pattern);
      if (match) {
        // Simple method count estimation
        const methodCount = this.estimateMethodCount(code, index + 1);
        classes.push({
          name: match[1] || 'anonymous',
          line: index + 1,
          methods: methodCount
        });
      }
    });

    return classes;
  }

  protected extractImports(code: string, pattern: RegExp): string[] {
    const imports: string[] = [];
    const lines = code.split('\n');
    
    lines.forEach(line => {
      const match = line.match(pattern);
      if (match) {
        imports.push(match[1] || match[0]);
      }
    });

    return imports;
  }

  private estimateFunctionComplexity(line: string): number {
    // Simple complexity estimation based on keywords
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try'];
    let complexity = 1; // Base complexity
    
    complexityKeywords.forEach(keyword => {
      if (line.includes(keyword)) {
        complexity++;
      }
    });

    return complexity;
  }

  private estimateMethodCount(code: string, classLine: number): number {
    const lines = code.split('\n');
    let methodCount = 0;
    let inClass = false;
    let braceCount = 0;

    for (let i = classLine - 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (i === classLine - 1) {
        inClass = true;
        continue;
      }

      if (inClass) {
        if (line.includes('{')) {
          braceCount++;
        }
        if (line.includes('}')) {
          braceCount--;
          if (braceCount === 0) {
            break;
          }
        }

        // Simple method detection (can be overridden by language-specific implementations)
        if (line.match(/(function|def|public|private|protected)\s+\w+/)) {
          methodCount++;
        }
      }
    }

    return methodCount;
  }
}