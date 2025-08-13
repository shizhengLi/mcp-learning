export interface AnalysisResult {
  filePath: string;
  language: string;
  issues: AnalysisIssue[];
  metrics: CodeMetrics;
  suggestions: RefactoringSuggestion[];
  timestamp: number;
}

export interface AnalysisIssue {
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line: number;
  column?: number;
  rule: string;
  fix?: {
    description: string;
    replacement: string;
  };
}

export interface CodeMetrics {
  complexity: number;
  maintainability: number;
  linesOfCode: number;
  commentLines: number;
  commentPercentage: number;
  functionCount: number;
  averageFunctionLength: number;
  dependencies: string[];
  technicalDebt: number;
}

export interface RefactoringSuggestion {
  type: 'extract' | 'inline' | 'rename' | 'restructure' | 'optimize' | 'modernize' | 'document';
  priority: 'low' | 'medium' | 'high';
  description: string;
  line: number;
  estimatedImpact: {
    complexityReduction?: number;
    maintainabilityImprovement?: number;
    performanceImprovement?: string;
  };
}

export interface AnalysisOptions {
  rules?: string[] | undefined;
  thresholds?: {
    complexity?: number | { high: number; medium: number; low: number } | undefined;
    maintainability?: number | { poor: number; fair: number; good: number; excellent: number } | undefined;
    coverage?: number | { poor: number; fair: number; good: number; excellent: number } | undefined;
  } | undefined;
  includeSuggestions?: boolean | undefined;
  skipDependencies?: boolean | undefined;
}

export interface LanguageSupport {
  name: string;
  extensions: string[];
  analyze: (code: string, filePath: string, options: AnalysisOptions) => Promise<AnalysisResult>;
}

export abstract class BaseCodeAnalyzer {
  protected supportedLanguages: Map<string, LanguageSupport> = new Map();
  protected options: AnalysisOptions;

  constructor(options: AnalysisOptions = {}) {
    this.options = {
      includeSuggestions: true,
      skipDependencies: false,
      ...options,
    };
  }

  public abstract initialize(): Promise<void>;

  public async analyzeFile(filePath: string, options?: AnalysisOptions): Promise<AnalysisResult> {
    const language = this.detectLanguage(filePath);
    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    const code = await this.readFile(filePath);
    const analysisOptions = { ...this.options, ...options };

    return language.analyze(code, filePath, analysisOptions);
  }

  public async analyzeFiles(filePaths: string[], options?: AnalysisOptions): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.analyzeFile(filePath, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to analyze ${filePath}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  public getSupportedLanguages(): string[] {
    return Array.from(this.supportedLanguages.keys());
  }

  public isLanguageSupported(language: string): boolean {
    return this.supportedLanguages.has(language);
  }

  protected registerLanguage(language: LanguageSupport): void {
    this.supportedLanguages.set(language.name, language);
  }

  protected detectLanguage(filePath: string): LanguageSupport | null {
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (!extension) return null;

    for (const language of this.supportedLanguages.values()) {
      if (language.extensions.includes(extension)) {
        return language;
      }
    }

    return null;
  }

  protected async readFile(_filePath: string): Promise<string> {
    // This will be implemented when we add file system support
    throw new Error('File reading not implemented - use analyzeFile with content parameter');
  }

  protected calculateComplexity(code: string): number {
    // Basic complexity calculation - can be overridden by language-specific analyzers
    const lines = code.split('\n');
    let complexity = 1; // Base complexity

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('if') || trimmed.includes('else if') || 
          trimmed.includes('for') || trimmed.includes('while') ||
          trimmed.includes('switch') || trimmed.includes('case') ||
          trimmed.includes('try') || trimmed.includes('catch')) {
        complexity++;
      }
    }

    return complexity;
  }

  protected calculateMaintainability(metrics: CodeMetrics): number {
    // Maintainability index calculation (simplified)
    const complexityFactor = Math.max(0, 100 - (metrics.complexity * 2));
    const lengthFactor = Math.max(0, 100 - (metrics.linesOfCode / 10));
    const commentFactor = metrics.commentPercentage;
    
    return Math.round((complexityFactor + lengthFactor + commentFactor) / 3);
  }

  protected calculateTechnicalDebt(metrics: CodeMetrics): number {
    // Technical debt calculation (simplified)
    let debt = 0;
    
    if (metrics.complexity > 10) debt += (metrics.complexity - 10) * 2;
    if (metrics.maintainability < 50) debt += (50 - metrics.maintainability);
    if (metrics.commentPercentage < 20) debt += (20 - metrics.commentPercentage);
    
    return Math.max(0, debt);
  }

  protected validateOptions(options: AnalysisOptions): void {
    if (options.thresholds) {
      if (options.thresholds.complexity !== undefined) {
        const complexityValue = typeof options.thresholds.complexity === 'number' 
          ? options.thresholds.complexity 
          : Math.min(...Object.values(options.thresholds.complexity));
        if (complexityValue < 1) {
          throw new Error('Complexity threshold must be at least 1');
        }
      }
      if (options.thresholds.maintainability !== undefined) {
        const maintainabilityValue = typeof options.thresholds.maintainability === 'number' 
          ? options.thresholds.maintainability 
          : Math.min(...Object.values(options.thresholds.maintainability));
        if (maintainabilityValue < 0 || maintainabilityValue > 100) {
          throw new Error('Maintainability threshold must be between 0 and 100');
        }
      }
      if (options.thresholds.coverage !== undefined) {
        const coverageValue = typeof options.thresholds.coverage === 'number' 
          ? options.thresholds.coverage 
          : Math.min(...Object.values(options.thresholds.coverage));
        if (coverageValue < 0 || coverageValue > 100) {
          throw new Error('Coverage threshold must be between 0 and 100');
        }
      }
    }
  }
}