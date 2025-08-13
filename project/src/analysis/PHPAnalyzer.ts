import {
  BaseCodeAnalyzer,
  AnalysisResult,
  AnalysisOptions,
  CodeMetrics,
  RefactoringSuggestion,
  AnalysisIssue,
} from './BaseCodeAnalyzer'

export class PHPAnalyzer extends BaseCodeAnalyzer {
  private readonly complexityKeywords = [
    'if',
    'else',
    'elseif',
    'switch',
    'case',
    'default',
    'for',
    'foreach',
    'while',
    'do',
    'function',
    'try',
    'catch',
  ]

  constructor(options?: AnalysisOptions) {
    super(options)
  }

  async initialize(): Promise<void> {
    // Initialize PHP-specific language support
    this.registerLanguage({
      name: 'php',
      extensions: ['php'],
      analyze: async (_code: string, filePath: string, options: AnalysisOptions) => {
        return this.analyzeFile(filePath, options)
      },
    })
  }

  public override async analyzeFile(
    filePath: string,
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult> {
    const content = await this.readFile(filePath)
    const lines = content.split('\n')

    const metrics = this.calculateMetrics(content, lines)
    const issues = this.detectIssues(content, lines, options)
    const suggestions = this.generateSuggestions(content, metrics, issues)

    return {
      filePath,
      language: 'php',
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
        !trimmed.startsWith('#')
      )
    }).length

    const commentLines = lines.filter(line => {
      const trimmed = line.trim()
      return (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('#')
      )
    }).length

    const totalLines = lines.length
    const commentPercentage = totalLines > 0 ? (commentLines / totalLines) * 100 : 0

    const complexity = this.calculateComplexity(content)
    const maintainability = this.calculateMaintainability({
      linesOfCode: codeLines,
      complexity,
      maintainability: 100,
      commentLines,
      commentPercentage,
      functionCount: 0,
      averageFunctionLength: 0,
      dependencies: [],
      technicalDebt: 0,
    })
    const functionCount = this.countFunctions(content)
    const averageFunctionLength = functionCount > 0 ? codeLines / functionCount : 0

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

    // Add complexity for ternary operators
    const ternaryCount = (content.match(/\?/g) || []).length
    complexity += ternaryCount * 0.5

    // Add complexity for nested structures
    const nestedBraces = (content.match(/{/g) || []).length
    complexity += nestedBraces * 0.4

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
    if (metrics.commentPercentage < 10) maintainability -= 10
    else if (metrics.commentPercentage > 30) maintainability += 5

    return Math.max(0, Math.min(100, maintainability))
  }

  private countFunctions(content: string): number {
    const functionMatches = content.match(/function\s+\w+/g)
    return functionMatches ? functionMatches.length : 0
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = []

    // Extract require statements
    const requireMatches = content.match(/require(_once)?\s+['"]([^'"]+)['"]/g)
    if (requireMatches) {
      requireMatches.forEach(match => {
        const dependency = match.match(/require(_once)?\s+['"]([^'"]+)['"]/)
        if (dependency) {
          dependencies.push(dependency[2])
        }
      })
    }

    // Extract include statements
    const includeMatches = content.match(/include(_once)?\s+['"]([^'"]+)['"]/g)
    if (includeMatches) {
      includeMatches.forEach(match => {
        const dependency = match.match(/include(_once)?\s+['"]([^'"]+)['"]/)
        if (dependency) {
          dependencies.push(dependency[2])
        }
      })
    }

    // Extract use statements (namespaces)
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
      if (func.lines > 50) {
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
        : thresholds.complexity?.high || 12

    if (complexity > complexityThreshold) {
      issues.push({
        type: 'COMPLEXITY_HIGH',
        severity: 'error',
        message: `Code complexity is too high (${complexity})`,
        line: 1,
        suggestion: 'Consider refactoring to reduce complexity',
      })
    }

    // Check for long classes
    const classes = this.extractClasses(content)
    classes.forEach(cls => {
      if (cls.lines > 500) {
        issues.push({
          type: 'CLASS_TOO_LONG',
          severity: 'warning',
          message: `Class '${cls.name}' is too long (${cls.lines} lines)`,
          line: cls.startLine,
          suggestion: 'Consider breaking this class into smaller, more focused classes',
        })
      }
    })

    // Check for security issues
    const securityIssues = this.checkSecurityIssues(content, lines)
    issues.push(...securityIssues)

    // Check for naming conventions
    const namingIssues = this.checkNamingConventions(content, lines)
    issues.push(...namingIssues)

    return issues
  }

  private extractFunctions(content: string): any[] {
    const functions: any[] = []
    const lines = content.split('\n')
    let currentFunction: any = null

    lines.forEach((line, index) => {
      const functionMatch = line.match(/function\s+(\w+)\s*\(/)
      if (functionMatch) {
        if (currentFunction) {
          currentFunction.lines = index - currentFunction.startLine
          functions.push(currentFunction)
        }
        currentFunction = {
          name: functionMatch[1],
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

  private extractClasses(content: string): any[] {
    const classes: any[] = []
    const lines = content.split('\n')
    let currentClass: any = null

    lines.forEach((line, index) => {
      const classMatch = line.match(/class\s+(\w+)/)
      if (classMatch) {
        if (currentClass) {
          currentClass.lines = index - currentClass.startLine
          classes.push(currentClass)
        }
        currentClass = {
          name: classMatch[1],
          startLine: index + 1,
          lines: 0,
        }
      }
    })

    if (currentClass) {
      currentClass.lines = lines.length - currentClass.startLine
      classes.push(currentClass)
    }

    return classes
  }

  private checkSecurityIssues(_content: string, lines: string[]): any[] {
    const issues: any[] = []

    // Check for SQL injection vulnerabilities
    lines.forEach((line, index) => {
      if (line.match(/\$_(GET|POST|REQUEST)/) && line.match(/mysql_query/i)) {
        issues.push({
          type: 'SECURITY_ISSUES',
          severity: 'error',
          message: 'Potential SQL injection vulnerability detected',
          line: index + 1,
          suggestion:
            'Use prepared statements or parameterized queries instead of direct variable interpolation',
        })
      }
    })

    // Check for XSS vulnerabilities
    lines.forEach((line, index) => {
      if (line.match(/echo\s+\$_(GET|POST|REQUEST)/) && !line.match(/htmlspecialchars/)) {
        issues.push({
          type: 'SECURITY_ISSUES',
          severity: 'error',
          message: 'Potential XSS vulnerability detected',
          line: index + 1,
          suggestion:
            'Use htmlspecialchars() or similar escaping functions when outputting user input',
        })
      }
    })

    // Check for file inclusion vulnerabilities
    lines.forEach((line, index) => {
      if (line.match(/(require|include)(_once)?\s+\$_/)) {
        issues.push({
          type: 'SECURITY_ISSUES',
          severity: 'error',
          message: 'Potential file inclusion vulnerability detected',
          line: index + 1,
          suggestion: 'Avoid using user input in file inclusion statements',
        })
      }
    })

    return issues
  }

  private checkNamingConventions(_content: string, lines: string[]): any[] {
    const issues: any[] = []

    // Check for class naming (should be PascalCase)
    lines.forEach((line, index) => {
      const classMatch = line.match(/class\s+([a-z][a-zA-Z0-9_]*)/)
      if (
        classMatch &&
        classMatch[1] !== classMatch[1].charAt(0).toUpperCase() + classMatch[1].slice(1)
      ) {
        issues.push({
          type: 'NAMING_CONVENTIONS',
          severity: 'warning',
          message: `Class '${classMatch[1]}' should use PascalCase naming convention`,
          line: index + 1,
          suggestion: 'Rename class to follow PascalCase convention',
        })
      }
    })

    // Check for function naming (should be camelCase or snake_case)
    lines.forEach((line, index) => {
      const functionMatch = line.match(/function\s+([A-Z][a-zA-Z0-9_]*)/)
      if (functionMatch) {
        issues.push({
          type: 'NAMING_CONVENTIONS',
          severity: 'warning',
          message: `Function '${functionMatch[1]}' should use camelCase or snake_case naming convention`,
          line: index + 1,
          suggestion: 'Rename function to follow standard naming convention',
        })
      }
    })

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
          'Improve code maintainability by adding more comments and reducing function length',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 20,
        },
      })
    }

    if (metrics.commentPercentage < 10) {
      suggestions.push({
        type: 'document',
        priority: 'low',
        description: 'Add more comments to explain complex logic and improve code readability',
        line: 1,
        estimatedImpact: {
          maintainabilityImprovement: 10,
        },
      })
    }

    if (metrics.averageFunctionLength > 30) {
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
