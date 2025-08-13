import {
  BaseCodeAnalyzer,
  AnalysisResult,
  AnalysisOptions,
  CodeMetrics,
  RefactoringSuggestion,
  AnalysisIssue,
} from './BaseCodeAnalyzer'

export class RustAnalyzer extends BaseCodeAnalyzer {
  private readonly complexityKeywords = [
    'if',
    'else',
    'for',
    'while',
    'loop',
    'match',
    'fn',
    'async',
    'await',
    'unsafe',
  ]

  async initialize(): Promise<void> {
    // Initialize Rust-specific language support
    this.registerLanguage({
      name: 'rust',
      extensions: ['rs'],
      analyze: async (code: string, filePath: string, options: AnalysisOptions) => {
        return this.analyzeRustCode(code, filePath, options)
      },
    })
  }

  constructor(options?: AnalysisOptions) {
    super(options)
  }

  private async analyzeRustCode(
    _code: string,
    filePath: string,
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    const content = await this.readFile(filePath)
    const lines = content.split('\n')

    const metrics = this.calculateMetrics(content, lines)
    const issues = this.detectIssues(content, lines, options)
    const suggestions = this.generateSuggestions(content, metrics, issues)

    return {
      filePath,
      language: 'rust',
      metrics,
      issues,
      suggestions,
      timestamp: Date.now(),
    }
  }

  private calculateMetrics(content: string, lines: string[]): CodeMetrics {
    const codeLines = lines.filter(line => {
      const trimmed = line.trim()
      return (
        trimmed &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('///')
      )
    }).length

    const commentLines = lines.filter(line => {
      const trimmed = line.trim()
      return (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('///')
      )
    }).length

    const totalLines = lines.length
    const commentPercentage = totalLines > 0 ? (commentLines / totalLines) * 100 : 0

    const complexity = this.calculateComplexity(content)
    const functionCount = this.countFunctions(content)
    const averageFunctionLength = functionCount > 0 ? codeLines / functionCount : 0

    return {
      linesOfCode: codeLines,
      complexity,
      maintainability: this.calculateMaintainability({
        linesOfCode: codeLines,
        complexity,
        maintainability: 100,
        commentLines,
        commentPercentage,
        functionCount,
        averageFunctionLength,
        dependencies: [],
        technicalDebt: 0,
      }),
      commentLines,
      commentPercentage,
      functionCount,
      averageFunctionLength,
      dependencies: this.extractDependencies(content),
      technicalDebt: this.calculateTechnicalDebt({
        linesOfCode: codeLines,
        complexity,
        maintainability: 100,
        commentLines,
        commentPercentage,
        functionCount,
        averageFunctionLength,
        dependencies: [],
        technicalDebt: 0,
      }),
    }
  }

  protected override calculateComplexity(content: string): number {
    let complexity = 1 // Base complexity

    for (const keyword of this.complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g')
      const matches = content.match(regex)
      if (matches) {
        complexity += matches.length
      }
    }

    // Add complexity for match arms
    const matchArms = (content.match(/=>/g) || []).length
    complexity += matchArms * 0.5

    // Add complexity for nested structures
    const nestedBraces = (content.match(/{/g) || []).length
    complexity += nestedBraces * 0.3

    // Add complexity for unsafe blocks
    const unsafeBlocks = (content.match(/unsafe/g) || []).length
    complexity += unsafeBlocks * 2

    return Math.round(complexity)
  }

  protected override calculateMaintainability(metrics: CodeMetrics): number {
    let maintainability = 100

    // Reduce maintainability based on complexity
    if (metrics.complexity > 15) maintainability -= 25
    else if (metrics.complexity > 10) maintainability -= 15
    else if (metrics.complexity > 5) maintainability -= 8

    // Adjust based on code length
    if (metrics.linesOfCode > 1000) maintainability -= 12
    else if (metrics.linesOfCode > 500) maintainability -= 8
    else if (metrics.linesOfCode > 200) maintainability -= 4

    // Adjust based on comment percentage
    if (metrics.commentPercentage < 15) maintainability -= 8
    else if (metrics.commentPercentage > 35) maintainability += 3

    return Math.max(0, Math.min(100, maintainability))
  }

  private countFunctions(content: string): number {
    const funcMatches = content.match(/fn\s+\w+/g)
    return funcMatches ? funcMatches.length : 0
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = []

    // Extract use statements
    const useMatches = content.match(/use\s+([^;]+);/g)
    if (useMatches) {
      useMatches.forEach(match => {
        const dependency = match
          .replace(/use\s+/, '')
          .replace(';', '')
          .trim()
        dependencies.push(dependency)
      })
    }

    // Extract extern crate statements
    const externMatches = content.match(/extern\s+crate\s+(\w+);/g)
    if (externMatches) {
      externMatches.forEach(match => {
        const crate = match.match(/extern\s+crate\s+(\w+)/)
        if (crate) {
          dependencies.push(crate[1])
        }
      })
    }

    return [...new Set(dependencies)]
  }

  protected override calculateTechnicalDebt(metrics: CodeMetrics): number {
    let debt = 0

    if (metrics.complexity > 15) debt += 25
    else if (metrics.complexity > 10) debt += 15
    else if (metrics.complexity > 5) debt += 8

    if (metrics.maintainability < 50) debt += 35
    else if (metrics.maintainability < 70) debt += 20
    else if (metrics.maintainability < 85) debt += 8

    return Math.min(100, debt)
  }

  private detectIssues(
    content: string,
    lines: string[],
    options: AnalysisOptions
  ): AnalysisIssue[] {
    const issues: any[] = []
    const thresholds = options.thresholds || {}

    // Check for long functions
    const functions = this.extractFunctions(content)
    functions.forEach(func => {
      if (func.lines > 40) {
        issues.push({
          type: 'FUNCTION_TOO_LONG',
          severity: 'warning',
          message: `Function '${func.name}' is too long (${func.lines} lines)`,
          line: func.startLine,
          suggestion: 'Consider breaking this function into smaller, more focused functions',
        })
      }
    })

    // Check for high complexity
    const complexity = this.calculateComplexity(content)
    const complexityThreshold =
      typeof thresholds.complexity === 'number'
        ? thresholds.complexity
        : thresholds.complexity?.high || 11

    if (complexity > complexityThreshold) {
      issues.push({
        type: 'COMPLEXITY_HIGH',
        severity: 'error',
        message: `Code complexity is too high (${complexity})`,
        line: 1,
        suggestion: 'Consider refactoring to reduce complexity',
      })
    }

    // Check for unsafe code usage
    const unsafeIssues = this.checkUnsafeCode(content, lines)
    issues.push(...unsafeIssues)

    // Check for cloning issues
    const cloningIssues = this.checkCloningIssues(content, lines)
    issues.push(...cloningIssues)

    // Check for lifetime management
    const lifetimeIssues = this.checkLifetimeManagement(content, lines)
    issues.push(...lifetimeIssues)

    return issues
  }

  private extractFunctions(content: string): any[] {
    const functions: any[] = []
    const lines = content.split('\n')
    let currentFunction: any = null

    lines.forEach((line, index) => {
      const funcMatch = line.match(/fn\s+(\w+)\s*\(/)
      if (funcMatch) {
        if (currentFunction) {
          currentFunction.lines = index - currentFunction.startLine
          functions.push(currentFunction)
        }
        currentFunction = {
          name: funcMatch[1],
          startLine: index + 1,
          lines: 0,
        }
      }
    })

    if (currentFunction) {
      currentFunction.lines = lines.length - currentFunction.startLine
      functions.push(currentFunction)
    }

    return functions
  }

  private checkUnsafeCode(_content: string, lines: string[]): any[] {
    const issues: any[] = []

    lines.forEach((line: string, index: number) => {
      if (line.includes('unsafe')) {
        issues.push({
          type: 'UNSAFE_CODE',
          severity: 'warning',
          message: 'Usage of unsafe code detected',
          line: index + 1,
          suggestion: 'Ensure unsafe code is absolutely necessary and properly documented',
        })
      }
    })

    return issues
  }

  private checkCloningIssues(content: string, _lines: string[]): any[] {
    const issues: any[] = []

    const cloneCount = (content.match(/\.clone\(\)/g) || []).length
    if (cloneCount > 10) {
      issues.push({
        type: 'CLONING_ISSUES',
        severity: 'warning',
        message: `High number of clone operations (${cloneCount}) detected`,
        line: 1,
        suggestion: 'Consider using references or borrowing to reduce cloning',
      })
    }

    return issues
  }

  private checkLifetimeManagement(content: string, _lines: string[]): any[] {
    const issues: any[] = []

    // Check for complex lifetime annotations
    const complexLifetimes = content.match(/'a:.*'b/g)
    if (complexLifetimes) {
      issues.push({
        type: 'LIFETIME_MANAGEMENT',
        severity: 'warning',
        message: 'Complex lifetime annotations detected',
        line: 1,
        suggestion: 'Consider simplifying lifetime relationships or using clearer naming',
      })
    }

    return issues
  }

  private generateSuggestions(
    _content: string,
    metrics: CodeMetrics,
    _issues: any[]
  ): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = []

    if (metrics.complexity > 10) {
      suggestions.push({
        type: 'restructure',
        priority: 'high',
        description: 'Consider breaking down complex functions into smaller, more focused units',
        line: 1,
        estimatedImpact: {
          complexityReduction: metrics.complexity - 8,
          maintainabilityImprovement: 15,
        },
      })
    }

    if (metrics.maintainability < 70) {
      suggestions.push({
        type: 'document',
        priority: 'medium',
        description:
          'Improve code maintainability by adding more documentation and reducing function length',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 20,
        },
      })
    }

    if (metrics.commentPercentage < 15) {
      suggestions.push({
        type: 'document',
        priority: 'low',
        description:
          'Add more documentation comments to explain complex logic and improve code readability',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 10,
        },
      })
    }

    if (metrics.averageFunctionLength > 25) {
      suggestions.push({
        type: 'extract',
        priority: 'medium',
        description: 'Consider breaking large functions into smaller, more focused functions',
        line: 1,
        estimatedImpact: {
          complexityReduction: 5,
          maintainabilityImprovement: 10,
        },
      })
    }

    return suggestions
  }
}
