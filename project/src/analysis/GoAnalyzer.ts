import {
  BaseCodeAnalyzer,
  AnalysisResult,
  AnalysisOptions,
  CodeMetrics,
  AnalysisIssue,
  RefactoringSuggestion,
} from './BaseCodeAnalyzer'

export class GoAnalyzer extends BaseCodeAnalyzer {
  private readonly complexityKeywords = [
    'if',
    'else',
    'for',
    'switch',
    'select',
    'case',
    'default',
    'func',
    'defer',
    'go',
  ]

  async initialize(): Promise<void> {
    // Initialize Go-specific language support
    this.registerLanguage({
      name: 'go',
      extensions: ['go'],
      analyze: async (code: string, filePath: string, options: AnalysisOptions) => {
        return this.analyzeGoCode(code, filePath, options)
      },
    })
  }

  private async analyzeGoCode(
    code: string,
    filePath: string,
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    const lines = code.split('\n')

    const metrics = this.calculateMetrics(code, lines)
    const issues = this.detectIssues(code, lines, options)
    const suggestions = this.generateSuggestions(metrics)

    return {
      filePath,
      language: 'go',
      metrics,
      issues,
      suggestions,
      timestamp: Date.now(),
    }
  }

  protected override calculateComplexity(code: string): number {
    let complexity = 1 // Base complexity

    for (const keyword of this.complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g')
      const matches = code.match(regex)
      if (matches) {
        complexity += matches.length
      }
    }

    // Add complexity for nested structures
    const nestedBraces = (code.match(/{/g) || []).length
    complexity += nestedBraces * 0.5

    return Math.round(complexity)
  }

  protected override calculateMaintainability(metrics: CodeMetrics): number {
    let maintainability = 100

    // Reduce maintainability based on complexity
    if (metrics.complexity > 15) maintainability -= 30
    else if (metrics.complexity > 10) maintainability -= 20
    else if (metrics.complexity > 5) maintainability -= 10

    // Adjust based on code length
    if (metrics.linesOfCode > 1000) maintainability -= 15
    else if (metrics.linesOfCode > 500) maintainability -= 10
    else if (metrics.linesOfCode > 200) maintainability -= 5

    // Adjust based on comment percentage
    if (metrics.commentPercentage < 10) maintainability -= 10
    else if (metrics.commentPercentage > 30) maintainability += 5

    return Math.max(0, Math.min(100, maintainability))
  }

  protected override calculateTechnicalDebt(metrics: CodeMetrics): number {
    let debt = 0

    if (metrics.complexity > 15) debt += 30
    else if (metrics.complexity > 10) debt += 20
    else if (metrics.complexity > 5) debt += 10

    if (metrics.maintainability < 50) debt += 40
    else if (metrics.maintainability < 70) debt += 25
    else if (metrics.maintainability < 85) debt += 10

    return Math.min(100, debt)
  }

  private calculateMetrics(code: string, lines: string[]): CodeMetrics {
    const codeLines = lines.filter(line => {
      const trimmed = line.trim()
      return (
        trimmed &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('*')
      )
    }).length

    const commentLines = lines.filter(line => {
      const trimmed = line.trim()
      return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')
    }).length

    const totalLines = lines.length
    const commentPercentage = totalLines > 0 ? (commentLines / totalLines) * 100 : 0

    const complexity = this.calculateComplexity(code)
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
    const functionCount = this.countFunctions(code)
    const averageFunctionLength = functionCount > 0 ? codeLines / functionCount : 0
    const dependencies = this.extractDependencies(code)
    const technicalDebt = this.calculateTechnicalDebt({
      linesOfCode: codeLines,
      complexity,
      maintainability,
      commentLines,
      commentPercentage,
      functionCount,
      averageFunctionLength,
      dependencies,
      technicalDebt: 0,
    })

    return {
      linesOfCode: codeLines,
      complexity,
      maintainability,
      commentLines,
      commentPercentage,
      functionCount,
      averageFunctionLength,
      dependencies,
      technicalDebt,
    }
  }

  private countFunctions(code: string): number {
    const funcMatches = code.match(/func\s+\w+/g)
    return funcMatches ? funcMatches.length : 0
  }

  private extractDependencies(code: string): string[] {
    const imports: string[] = []
    const importMatches = code.match(/import\s+([^"\n]+)/g)

    if (importMatches) {
      importMatches.forEach(match => {
        const importPath = match.replace(/import\s+/, '').trim()
        if (importPath && !importPath.startsWith('(')) {
          imports.push(importPath)
        }
      })
    }

    // Handle multi-line imports
    const multilineImports = code.match(/import\s+\(([\s\S]*?)\)/g)
    if (multilineImports) {
      multilineImports.forEach(block => {
        const importsInBlock = block.match(/"([^"]+)"/g)
        if (importsInBlock) {
          importsInBlock.forEach(imp => {
            imports.push(imp.replace(/"/g, ''))
          })
        }
      })
    }

    return [...new Set(imports)]
  }

  private detectIssues(code: string, _lines: string[], options: AnalysisOptions): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []
    const thresholds = options.thresholds || {}

    // Check for long functions
    const functions = this.extractFunctions(code)
    functions.forEach(func => {
      if (func.lines > 50) {
        issues.push({
          type: 'warning',
          severity: 'medium',
          message: `Function '${func.name}' is too long (${func.lines} lines)`,
          line: func.startLine,
          rule: 'FUNCTION_TOO_LONG',
          fix: {
            description: 'Consider breaking this function into smaller, more focused functions',
          },
        })
      }
    })

    // Check for high complexity
    const complexity = this.calculateComplexity(code)
    const complexityThreshold =
      typeof thresholds.complexity === 'number'
        ? thresholds.complexity
        : thresholds.complexity?.high || 12

    if (complexity > complexityThreshold) {
      issues.push({
        type: 'error',
        severity: 'high',
        message: `Code complexity is too high (${complexity})`,
        line: 1,
        rule: 'COMPLEXITY_HIGH',
        fix: {
          description: 'Consider refactoring to reduce complexity',
        },
      })
    }

    // Check for error handling
    const errorHandlingIssues = this.checkErrorHandling(code)
    issues.push(...errorHandlingIssues)

    // Check for naming conventions
    const namingIssues = this.checkNamingConventions(code)
    issues.push(...namingIssues)

    return issues
  }

  private extractFunctions(code: string): any[] {
    const functions: any[] = []
    const lines = code.split('\n')
    let currentFunction: any = null

    lines.forEach((line, index) => {
      const funcMatch = line.match(/func\s+(\w+)\s*\(/)
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

  private checkErrorHandling(code: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []

    // Check for functions that might return errors but don't handle them
    const returnStatements = code.match(/\breturn\s+\w+/g) || []
    const errorChecks = code.match(/if\s+err\s*!=\s*nil/g) || []

    if (returnStatements.length > errorChecks.length) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        message: 'Potential missing error handling',
        line: 1,
        rule: 'ERROR_HANDLING',
        fix: {
          description: 'Ensure all functions that can return errors have proper error handling',
        },
      })
    }

    return issues
  }

  private checkNamingConventions(code: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []
    const lines = code.split('\n')

    // Check for public vs private naming
    lines.forEach((line, index) => {
      const publicVarMatch = line.match(/\b([A-Z][a-zA-Z0-9]*)\s*:/)
      if (publicVarMatch && publicVarMatch[1].length === 1) {
        issues.push({
          type: 'warning',
          severity: 'low',
          message: `Single-letter public variable name '${publicVarMatch[1]}' should be more descriptive`,
          line: index + 1,
          rule: 'NAMING_CONVENTION',
          fix: {
            description: 'Use descriptive names for public variables',
          },
        })
      }
    })

    return issues
  }

  private generateSuggestions(metrics: CodeMetrics): RefactoringSuggestion[] {
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
