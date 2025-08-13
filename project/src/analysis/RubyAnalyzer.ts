import { BaseCodeAnalyzer, AnalysisResult, AnalysisOptions, CodeMetrics, RefactoringSuggestion, AnalysisIssue } from './BaseCodeAnalyzer';

export class RubyAnalyzer extends BaseCodeAnalyzer {
  private readonly complexityKeywords = [
    'if', 'elsif', 'else', 'unless', 'case', 'when', 'while', 'until', 'for', 'begin', 'rescue', 'ensure'
  ];

  constructor(options?: AnalysisOptions) {
    super(options);
  }

  async initialize(): Promise<void> {
    // Initialize Ruby-specific language support
    this.registerLanguage({
      name: 'ruby',
      extensions: ['rb'],
      analyze: async (_code: string, filePath: string, options: AnalysisOptions) => {
        return this.analyzeFile(filePath, options);
      }
    });
  }

  public override async analyzeFile(filePath: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const content = await this.readFile(filePath);
    const lines = content.split('\n');
    
    const metrics = this.calculateMetrics(content, lines);
    const issues = this.detectIssues(content, lines, options);
    const suggestions = this.generateSuggestions(content, metrics, issues);

    return {
      filePath,
      language: 'ruby',
      metrics,
      issues,
      suggestions,
      timestamp: Date.now()
    };
  }

  private calculateMetrics(content: string, lines: string[]): CodeMetrics {
    const codeLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('=begin') && !trimmed.startsWith('=end');
    }).length;

    const commentLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('#') || trimmed.startsWith('=begin') || trimmed.startsWith('=end');
    }).length;

    const totalLines = lines.length;
    const commentPercentage = totalLines > 0 ? (commentLines / totalLines) * 100 : 0;

    const complexity = this.calculateComplexity(content);
    const maintainability = this.calculateMaintainability({
        linesOfCode: codeLines,
        complexity,
        maintainability: 100,
        commentLines,
        commentPercentage,
        functionCount: 0,
        averageFunctionLength: 0,
        dependencies: [],
        technicalDebt: 0
      });
    const functionCount = this.countFunctions(content);
    const averageFunctionLength = functionCount > 0 ? codeLines / functionCount : 0;

    return {
      linesOfCode: codeLines,
      complexity,
      maintainability,
      commentLines,
      commentPercentage,
      functionCount,
      averageFunctionLength,
      dependencies: this.extractDependencies(content),
      technicalDebt: this.calculateTechnicalDebt({
        linesOfCode: codeLines,
        complexity,
        maintainability,
        commentLines,
        commentPercentage,
        functionCount,
        averageFunctionLength,
        dependencies: this.extractDependencies(content),
        technicalDebt: 0
      })
    };
  }

  protected override calculateComplexity(content: string): number {
    let complexity = 1; // Base complexity
    
    for (const keyword of this.complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    // Add complexity for blocks
    const blockCount = (content.match(/\bdo\b/g) || []).length;
    complexity += blockCount;

    // Add complexity for ternary operators
    const ternaryCount = (content.match(/\?/g) || []).length;
    complexity += ternaryCount * 0.5;

    // Add complexity for method chaining
    const methodChains = (content.match(/\.(?=\w)/g) || []).length;
    complexity += methodChains * 0.3;

    return Math.round(complexity);
  }

  protected override calculateMaintainability(metrics: CodeMetrics): number {
    let maintainability = 100;
    
    // Reduce maintainability based on complexity
    if (metrics.complexity > 12) maintainability -= 20;
    else if (metrics.complexity > 8) maintainability -= 12;
    else if (metrics.complexity > 4) maintainability -= 6;

    // Adjust based on code length
    if (metrics.linesOfCode > 800) maintainability -= 10;
    else if (metrics.linesOfCode > 400) maintainability -= 6;
    else if (metrics.linesOfCode > 200) maintainability -= 3;

    // Adjust based on comment percentage
    if (metrics.commentPercentage < 8) maintainability -= 8;
    else if (metrics.commentPercentage > 25) maintainability += 4;

    return Math.max(0, Math.min(100, maintainability));
  }

  private countFunctions(content: string): number {
    const methodMatches = content.match(/def\s+\w+/g);
    return methodMatches ? methodMatches.length : 0;
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // Extract require statements
    const requireMatches = content.match(/require\s+['"]([^'"]+)['"]/g);
    if (requireMatches) {
      requireMatches.forEach(match => {
        const dependency = match.match(/require\s+['"]([^'"]+)['"]/);
        if (dependency) {
          dependencies.push(dependency[1]);
        }
      });
    }

    // Extract require_relative statements
    const relativeMatches = content.match(/require_relative\s+['"]([^'"]+)['"]/g);
    if (relativeMatches) {
      relativeMatches.forEach(match => {
        const dependency = match.match(/require_relative\s+['"]([^'"]+)['"]/);
        if (dependency) {
          dependencies.push(dependency[1]);
        }
      });
    }

    // Extract gem declarations
    const gemMatches = content.match(/gem\s+['"]([^'"]+)['"]/g);
    if (gemMatches) {
      gemMatches.forEach(match => {
        const gem = match.match(/gem\s+['"]([^'"]+)['"]/);
        if (gem) {
          dependencies.push(gem[1]);
        }
      });
    }

    return [...new Set(dependencies)];
  }

  protected override calculateTechnicalDebt(metrics: CodeMetrics): number {
    let debt = 0;
    
    if (metrics.complexity > 12) debt += 20;
    else if (metrics.complexity > 8) debt += 12;
    else if (metrics.complexity > 4) debt += 6;

    if (metrics.maintainability < 50) debt += 30;
    else if (metrics.maintainability < 70) debt += 18;
    else if (metrics.maintainability < 85) debt += 6;

    return Math.min(100, debt);
  }

  private detectIssues(content: string, lines: string[], options: AnalysisOptions): AnalysisIssue[] {
    const issues: any[] = [];
    const thresholds = options.thresholds || {};

    // Check for long methods
    const methods = this.extractMethods(content);
    methods.forEach(method => {
      if (method.lines > 30) {
        issues.push({
          type: 'METHOD_TOO_LONG',
          severity: 'warning',
          message: `Method '${method.name}' is too long (${method.lines} lines)`,
          line: method.startLine,
          suggestion: 'Consider breaking this method into smaller, more focused methods'
        });
      }
    });

    // Check for high complexity
    const complexity = this.calculateComplexity(content);
    const complexityThreshold = typeof thresholds.complexity === 'number' 
      ? thresholds.complexity 
      : thresholds.complexity?.high || 8;

    if (complexity > complexityThreshold) {
      issues.push({
        type: 'COMPLEXITY_HIGH',
        severity: 'error',
        message: `Code complexity is too high (${complexity})`,
        line: 1,
        suggestion: 'Consider refactoring to reduce complexity'
      });
    }

    // Check for long classes
    const classes = this.extractClasses(content);
    classes.forEach(cls => {
      if (cls.lines > 300) {
        issues.push({
          type: 'CLASS_TOO_LONG',
          severity: 'warning',
          message: `Class '${cls.name}' is too long (${cls.lines} lines)`,
          line: cls.startLine,
          suggestion: 'Consider breaking this class into smaller, more focused classes'
        });
      }
    });

    // Check for global variables
    const globalIssues = this.checkGlobalVariables(content, lines);
    issues.push(...globalIssues);

    // Check for metaprogramming issues
    const metaprogrammingIssues = this.checkMetaprogramming(content, lines);
    issues.push(...metaprogrammingIssues);

    return issues;
  }

  private extractMethods(content: string): any[] {
    const methods: any[] = [];
    const lines = content.split('\n');
    let currentMethod: any = null;

    lines.forEach((line, index) => {
      const methodMatch = line.match(/def\s+(\w+)/);
      if (methodMatch) {
        if (currentMethod) {
          currentMethod.lines = index - currentMethod.startLine;
          methods.push(currentMethod);
        }
        currentMethod = {
          name: methodMatch[1],
          startLine: index + 1,
          lines: 0
        };
      }
    });

    if (currentMethod) {
      currentMethod.lines = lines.length - currentMethod.startLine;
      methods.push(currentMethod);
    }

    return methods;
  }

  private extractClasses(content: string): any[] {
    const classes: any[] = [];
    const lines = content.split('\n');
    let currentClass: any = null;

    lines.forEach((line, index) => {
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        if (currentClass) {
          currentClass.lines = index - currentClass.startLine;
          classes.push(currentClass);
        }
        currentClass = {
          name: classMatch[1],
          startLine: index + 1,
          lines: 0
        };
      }
    });

    if (currentClass) {
      currentClass.lines = lines.length - currentClass.startLine;
      classes.push(currentClass);
    }

    return classes;
  }

  private checkGlobalVariables(_content: string, lines: string[]): any[] {
    const issues: any[] = [];
    
    lines.forEach((line, index) => {
      if (line.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/)) {
        issues.push({
          type: 'GLOBAL_VARIABLES',
          severity: 'warning',
          message: 'Usage of global variable detected',
          line: index + 1,
          suggestion: 'Consider using instance variables or constants instead of global variables'
        });
      }
    });

    return issues;
  }

  private checkMetaprogramming(_content: string, _lines: string[]): any[] {
    const issues: any[] = [];
    
    // Check for extensive metaprogramming
    const defineMethodCount = (_content.match(/define_method/g) || []).length;
    const sendCount = (_content.match(/\.send\(/g) || []).length;
    
    if (defineMethodCount > 5) {
      issues.push({
        type: 'METAPROGRAMMING',
        severity: 'warning',
        message: `High number of dynamic method definitions (${defineMethodCount}) detected`,
        line: 1,
        suggestion: 'Consider if metaprogramming is necessary or if regular methods would be clearer'
      });
    }

    if (sendCount > 10) {
      issues.push({
        type: 'METAPROGRAMMING',
        severity: 'warning',
        message: `High number of send method calls (${sendCount}) detected`,
        line: 1,
        suggestion: 'Consider using direct method calls when possible for better readability'
      });
    }

    return issues;
  }

  private generateSuggestions(_content: string, metrics: CodeMetrics, _issues: any[]): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    if (metrics.complexity > 8) {
      suggestions.push({
        type: 'restructure',
        priority: 'high',
        description: 'Consider breaking down complex methods into smaller, more focused units',
        line: 1,
        estimatedImpact: {
          complexityReduction: metrics.complexity - 6,
          maintainabilityImprovement: 15
        }
      });
    }

    if (metrics.maintainability < 70) {
      suggestions.push({
        type: 'document',
        priority: 'medium',
        description: 'Improve code maintainability by adding more comments and reducing method length',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 20
        }
      });
    }

    if (metrics.commentPercentage < 8) {
      suggestions.push({
        type: 'document',
        priority: 'low',
        description: 'Add more comments to explain complex logic and improve code readability',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 10
        }
      });
    }

    if (metrics.averageFunctionLength > 20) {
      suggestions.push({
        type: 'extract',
        priority: 'medium',
        description: 'Consider breaking large methods into smaller, more focused methods',
        line: 1,
        estimatedImpact: {
          complexityReduction: 3,
          maintainabilityImprovement: 10
        }
      });
    }

    return suggestions;
  }

}