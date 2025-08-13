import { BaseLanguageAnalyzer } from './BaseLanguageAnalyzer'
import { CodeMetrics, RefactoringSuggestion, AnalysisIssue as Issue } from './BaseCodeAnalyzer'

export class JavaScriptAnalyzer extends BaseLanguageAnalyzer {
  constructor() {
    super(
      'javascript',
      ['js', 'jsx', 'mjs'],
      [
        'ES6_STANDARDS',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'VARIABLE_NAMING',
        'UNDEFINED_VARIABLES',
        'MISSING_SEMICOLONS',
        'NO_VAR_USAGE',
        'NO_EVAL_USAGE',
        'STRICT_EQUALITY',
        'NO_CONSOLE_STATEMENTS',
      ],
      {
        complexity: { high: 8, medium: 4, low: 1 },
        maintainability: { poor: 45, fair: 70, good: 80, excellent: 90 },
      }
    )
  }

  protected calculateComplexity(code: string): number {
    let complexity = 1
    const lines = code.split('\n')

    lines.forEach(line => {
      const trimmed = line.trim()

      // Control structures
      if (trimmed.match(/\b(if|else if|for|while|switch|case|catch|try)\b/)) {
        complexity++
      }

      // Logical operators
      if (trimmed.match(/(&&|\|\|)/)) {
        complexity += 0.5
      }

      // Ternary operators
      if (trimmed.match(/\?/)) {
        complexity += 0.5
      }

      // Nested control structures
      if (trimmed.match(/\b(if|for|while)\b.*\b(if|for|while)\b/)) {
        complexity += 1
      }

      // Async/await complexity
      if (trimmed.match(/\b(async|await)\b/)) {
        complexity += 0.5
      }

      // Arrow functions with complex logic
      if (trimmed.match(/=>\s*\{/)) {
        complexity += 0.3
      }

      // Method calls (potential for complex logic)
      if (trimmed.match(/\.\w+\(/)) {
        complexity += 0.2
      }

      // Promise chains
      if (trimmed.match(/\.then\(|\.catch\(/)) {
        complexity += 0.5
      }
    })

    return Math.round(complexity)
  }

  protected calculateMaintainability(metrics: CodeMetrics): number {
    let maintainability = 100

    // Deduct for complexity
    maintainability -= (metrics.complexity - 1) * 1.5

    // Deduct for long functions
    if (metrics.averageFunctionLength > 30) {
      maintainability -= 15
    } else if (metrics.averageFunctionLength > 15) {
      maintainability -= 8
    }

    // Bonus for good commenting
    if (metrics.commentPercentage > 25) {
      maintainability += 8
    }

    // Deduct for low commenting
    if (metrics.commentPercentage < 15) {
      maintainability -= 12
    }

    // Deduct for too many dependencies
    if (metrics.dependencies.length > 10) {
      maintainability -= 5
    }

    return Math.max(0, Math.min(100, Math.round(maintainability)))
  }

  protected analyzeCodeStructure(code: string): {
    functions: Array<{ name: string; line: number; complexity: number }>
    classes: Array<{ name: string; line: number; methods: number }>
    imports: string[]
    exports: string[]
  } {
    const functions = this.extractFunctions(code, /function\s+(\w+)|(\w+)\s*[=:]\s*\(.*\)\s*=>/g)
    const classes = this.extractClasses(code, /class\s+(\w+)/g)
    const imports = this.extractImports(code, /import\s+.*?from\s+['"]([^'"]+)['"]/g)
    const exports = this.extractImports(
      code,
      /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g
    )

    // Also handle require() statements
    const requireImports = this.extractImports(code, /require\(['"]([^'"]+)['"]\)/g)

    // Combine all imports
    const allImports = [...imports, ...requireImports]

    // Filter out local imports (relative paths) and extract package names
    const filteredImports = allImports.filter(
      imp => !imp.startsWith('./') && !imp.startsWith('../') && !imp.startsWith('/')
    )

    return { functions, classes, imports: filteredImports, exports }
  }

  protected override extractImports(code: string, pattern: RegExp): string[] {
    const imports: string[] = []
    const lines = code.split('\n')

    lines.forEach(line => {
      const match = line.match(pattern)
      if (match && match[1]) {
        imports.push(match[1])
      }
    })

    return imports
  }

  protected checkLanguageSpecificRules(code: string, rules: string[]): Issue[] {
    const issues: Issue[] = []
    const lines = code.split('\n')

    rules.forEach(rule => {
      switch (rule) {
        case 'ES6_STANDARDS':
          issues.push(...this.checkES6Standards(code, lines))
          break
        case 'COMPLEXITY_HIGH':
          issues.push(...this.checkHighComplexity(code, lines))
          break
        case 'FUNCTION_TOO_LONG':
          issues.push(...this.checkFunctionLength(code, lines))
          break
        case 'VARIABLE_NAMING':
          issues.push(...this.checkVariableNaming(code, lines))
          break
        case 'UNDEFINED_VARIABLES':
          issues.push(...this.checkUndefinedVariables(code, lines))
          break
        case 'MISSING_SEMICOLONS':
          issues.push(...this.checkMissingSemicolons(code, lines))
          break
        case 'NO_VAR_USAGE':
          issues.push(...this.checkVarUsage(code, lines))
          break
        case 'NO_EVAL_USAGE':
          issues.push(...this.checkEvalUsage(code, lines))
          break
        case 'STRICT_EQUALITY':
          issues.push(...this.checkStrictEquality(code, lines))
          break
        case 'NO_CONSOLE_STATEMENTS':
          issues.push(...this.checkConsoleStatements(code, lines))
          break
      }
    })

    return issues
  }

  public async initialize(): Promise<void> {
    // Initialize JavaScript analyzer
  }

  protected generateLanguageSpecificSuggestions(
    code: string,
    _metrics: CodeMetrics
  ): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = []
    const lines = code.split('\n')

    // Suggest async/await for Promise chains
    const promiseChains = lines.filter(
      line => line.includes('.then') || line.includes('.catch')
    ).length
    if (promiseChains > 1) {
      suggestions.push(
        this.createRefactoringSuggestion(
          'restructure',
          'medium',
          `Consider using async/await instead of ${promiseChains} Promise chains for better readability`,
          1,
          { maintainabilityImprovement: 15 }
        )
      )
    }

    // Suggest template literals over string concatenation
    const concatenations = lines.filter(line => line.includes('+') && line.includes('"')).length
    if (concatenations > 1) {
      suggestions.push(
        this.createRefactoringSuggestion(
          'optimize',
          'low',
          `Use template literals instead of ${concatenations} string concatenation operations`,
          1,
          { maintainabilityImprovement: 8 }
        )
      )
    }

    // Suggest arrow functions for simple callbacks
    const functionKeywords = lines.filter(
      line => line.includes('function (') || line.includes('function(')
    ).length
    if (functionKeywords > 0) {
      suggestions.push(
        this.createRefactoringSuggestion(
          'optimize',
          'low',
          'Consider using arrow functions for simple callbacks',
          1,
          { maintainabilityImprovement: 5 }
        )
      )
    }

    // Suggest array methods for loops
    const forLoops = lines.filter(line => line.includes('for (') || line.includes('for(')).length
    if (forLoops > 2) {
      suggestions.push(
        this.createRefactoringSuggestion(
          'restructure',
          'medium',
          `Consider using array methods (map, filter, reduce) instead of ${forLoops} for loops`,
          1,
          { maintainabilityImprovement: 12 }
        )
      )
    }

    // Suggest destructuring for object property access
    const dotNotations = lines.filter(line => line.match(/\w+\.\w+/)).length
    if (dotNotations > 5) {
      suggestions.push(
        this.createRefactoringSuggestion(
          'optimize',
          'low',
          'Consider using destructuring assignment for cleaner object property access',
          1,
          { maintainabilityImprovement: 10 }
        )
      )
    }

    return suggestions
  }

  protected async readFile(_filePath: string): Promise<string> {
    // Mock implementation - in real implementation, read from file system
    return `// Mock JavaScript file content
function helloWorld() {
  console.log("Hello, World!");
  return true;
}

class ExampleClass {
  constructor(name) {
    this.name = name;
  }
  
  greet() {
    return \`Hello, \${this.name}!\`;
  }
}

export { helloWorld, ExampleClass };`
  }

  private checkES6Standards(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []

    lines.forEach((line, index) => {
      const lineNumber = index + 1

      // Check for var usage (should use let/const)
      if (line.includes('var ')) {
        issues.push(
          this.createIssue(
            'warning',
            'medium',
            'Use let or const instead of var',
            lineNumber,
            'ES6_STANDARDS',
            {
              description: 'Replace var with let or const for block-scoped variables',
            }
          )
        )
      }

      // Check for function declarations in blocks
      if (line.match(/if\s*\([^)]+\)\s*\{[^}]*function\s+\w+/)) {
        issues.push(
          this.createIssue(
            'warning',
            'medium',
            'Function declaration in block scope',
            lineNumber,
            'ES6_STANDARDS',
            {
              description: 'Use function expressions or arrow functions in blocks',
            }
          )
        )
      }
    })

    return issues
  }

  private checkHighComplexity(code: string, _lines: string[]): Issue[] {
    const issues: Issue[] = []
    const complexity = this.calculateComplexity(code)

    if (complexity > this.config.complexity.high) {
      issues.push(
        this.createIssue(
          'warning',
          'high',
          `Code complexity too high (${complexity} > ${this.config.complexity.high})`,
          1,
          'COMPLEXITY_HIGH',
          {
            description: 'Consider breaking down complex code into smaller functions',
          }
        )
      )
    }

    return issues
  }

  private checkFunctionLength(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []

    // Simple function length detection
    let inFunction = false
    let functionStart = 0
    let functionLines = 0

    lines.forEach((line, index) => {
      if (line.match(/function\s+\w+|\w+\s*[=:]\s*\(.*\)\s*=>/)) {
        if (inFunction && functionLines > 25) {
          issues.push(
            this.createIssue(
              'warning',
              'medium',
              `Function too long (${functionLines} lines)`,
              functionStart,
              'FUNCTION_TOO_LONG',
              {
                description: 'Consider breaking down long function into smaller functions',
              }
            )
          )
        }
        inFunction = true
        functionStart = index + 1
        functionLines = 0
      } else if (
        inFunction &&
        line.trim() &&
        !line.match(/function\s+\w+|\w+\s*[=:]\s*\(.*\)\s*=>/)
      ) {
        functionLines++
      }
    })

    return issues
  }

  private checkVariableNaming(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []

    lines.forEach((line, index) => {
      const lineNumber = index + 1

      // Check for camelCase naming
      const varMatch = line.match(/(?:let|const|var)\s+(\w+)\s*=/)
      if (varMatch && !varMatch[1].match(/^[a-z][a-zA-Z0-9]*$/)) {
        issues.push(
          this.createIssue(
            'warning',
            'low',
            `Variable name "${varMatch[1]}" should use camelCase`,
            lineNumber,
            'VARIABLE_NAMING',
            {
              description: 'Rename variable to follow camelCase convention',
            }
          )
        )
      }
    })

    return issues
  }

  private checkUndefinedVariables(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []
    const definedVars = new Set<string>()

    // First pass: collect defined variables
    lines.forEach((line: string) => {
      const matches = line.match(/(?:let|const|var)\s+(\w+)/g)
      if (matches) {
        matches.forEach(match => {
          const varName = match.replace(/(?:let|const|var)\s+/, '')
          definedVars.add(varName)
        })
      }
    })

    // Second pass: check for undefined variables
    lines.forEach((line, index) => {
      const varUsage = line.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g)
      if (varUsage) {
        varUsage.forEach(varName => {
          if (
            !definedVars.has(varName) &&
            ![
              'console',
              'window',
              'document',
              'process',
              'global',
              'this',
              'Array',
              'Object',
              'String',
              'Number',
              'Boolean',
              'Date',
              'Math',
              'JSON',
            ].includes(varName)
          ) {
            issues.push(
              this.createIssue(
                'warning',
                'medium',
                `Undefined variable "${varName}"`,
                index + 1,
                'UNDEFINED_VARIABLES',
                {
                  description: 'Variable is used but not defined',
                }
              )
            )
          }
        })
      }
    })

    return issues
  }

  private checkMissingSemicolons(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      const lineNumber = index + 1

      // Check for missing semicolons (basic detection)
      if (
        trimmed.length > 0 &&
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
        !trimmed.includes('${')
      ) {
        issues.push(
          this.createIssue(
            'warning',
            'low',
            'Missing semicolon',
            lineNumber,
            'MISSING_SEMICOLONS',
            {
              description: 'Add semicolon at the end of the statement',
            }
          )
        )
      }
    })

    return issues
  }

  private checkVarUsage(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []

    lines.forEach((line, index) => {
      if (line.includes('var ')) {
        issues.push(
          this.createIssue(
            'warning',
            'medium',
            'Use let or const instead of var',
            index + 1,
            'NO_VAR_USAGE',
            {
              description: 'Replace var with let or const for better scoping',
            }
          )
        )
      }
    })

    return issues
  }

  private checkEvalUsage(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []

    lines.forEach((line, index) => {
      if (line.includes('eval(')) {
        issues.push(
          this.createIssue(
            'error',
            'high',
            'eval() usage is dangerous and should be avoided',
            index + 1,
            'NO_EVAL_USAGE',
            {
              description: 'Replace eval() with safer alternatives',
            }
          )
        )
      }
    })

    return issues
  }

  private checkStrictEquality(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []

    lines.forEach((line, index) => {
      if (line.includes('==') && !line.includes('===') && !line.includes('!=')) {
        issues.push(
          this.createIssue(
            'warning',
            'medium',
            'Use === instead of == for strict equality',
            index + 1,
            'STRICT_EQUALITY',
            {
              description: 'Use strict equality operators (===, !==)',
            }
          )
        )
      }
    })

    return issues
  }

  private checkConsoleStatements(_code: string, lines: string[]): Issue[] {
    const issues: Issue[] = []

    lines.forEach((line, index) => {
      if (
        line.includes('console.log') ||
        line.includes('console.error') ||
        line.includes('console.warn')
      ) {
        issues.push(
          this.createIssue(
            'warning',
            'low',
            'Console statement found in production code',
            index + 1,
            'NO_CONSOLE_STATEMENTS',
            {
              description: 'Remove console statements from production code',
            }
          )
        )
      }
    })

    return issues
  }
}
