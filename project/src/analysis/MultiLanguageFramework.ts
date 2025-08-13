import { BaseCodeAnalyzer, AnalysisResult, AnalysisOptions, CodeMetrics } from './BaseCodeAnalyzer'
import { PythonAnalyzer } from './PythonAnalyzer'
import { JavaScriptAnalyzer } from './JavaScriptAnalyzer'
import { TypeScriptAnalyzer } from './TypeScriptAnalyzer'
import { JavaAnalyzer } from './JavaAnalyzer'
import { GoAnalyzer } from './GoAnalyzer'
import { RustAnalyzer } from './RustAnalyzer'
import { RubyAnalyzer } from './RubyAnalyzer'
import { PHPAnalyzer } from './PHPAnalyzer'

export interface LanguageConfig {
  name: string
  extensions: string[]
  analyzer: new (options?: AnalysisOptions) => BaseCodeAnalyzer
  defaultRules: string[]
  metrics: {
    complexity: {
      high: number
      medium: number
      low: number
    }
    maintainability: {
      poor: number
      fair: number
      good: number
      excellent: number
    }
  }
}

export class MultiLanguageFramework {
  private languages: Map<string, LanguageConfig> = new Map()
  private extensionMap: Map<string, string> = new Map()

  constructor() {
    this.initializeLanguages()
  }

  private initializeLanguages(): void {
    // Register Python
    this.registerLanguage({
      name: 'python',
      extensions: ['py', 'pyx'],
      analyzer: PythonAnalyzer,
      defaultRules: [
        'PEP8_STYLE',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'VARIABLE_NAMING',
        'MISSING_TYPE_HINTS',
        'UNUSED_IMPORTS',
      ],
      metrics: {
        complexity: {
          high: 10,
          medium: 5,
          low: 1,
        },
        maintainability: {
          poor: 50,
          fair: 75,
          good: 85,
          excellent: 95,
        },
      },
    })

    // Register JavaScript
    this.registerLanguage({
      name: 'javascript',
      extensions: ['js', 'jsx', 'mjs'],
      analyzer: JavaScriptAnalyzer,
      defaultRules: [
        'ES6_STANDARDS',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'VARIABLE_NAMING',
        'UNDEFINED_VARIABLES',
        'MISSING_SEMICOLONS',
      ],
      metrics: {
        complexity: {
          high: 8,
          medium: 4,
          low: 1,
        },
        maintainability: {
          poor: 45,
          fair: 70,
          good: 80,
          excellent: 90,
        },
      },
    })

    // Register TypeScript
    this.registerLanguage({
      name: 'typescript',
      extensions: ['ts', 'tsx'],
      analyzer: TypeScriptAnalyzer,
      defaultRules: [
        'TYPE_SAFETY',
        'ES6_STANDARDS',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'INTERFACE_NAMING',
        'UNUSED_VARIABLES',
      ],
      metrics: {
        complexity: {
          high: 9,
          medium: 5,
          low: 1,
        },
        maintainability: {
          poor: 55,
          fair: 75,
          good: 85,
          excellent: 95,
        },
      },
    })

    // Register Java
    this.registerLanguage({
      name: 'java',
      extensions: ['java'],
      analyzer: JavaAnalyzer,
      defaultRules: [
        'JAVA_NAMING_CONVENTIONS',
        'COMPLEXITY_HIGH',
        'METHOD_TOO_LONG',
        'CLASS_TOO_LONG',
        'UNUSED_IMPORTS',
        'MAGIC_NUMBERS',
      ],
      metrics: {
        complexity: {
          high: 15,
          medium: 8,
          low: 1,
        },
        maintainability: {
          poor: 40,
          fair: 65,
          good: 75,
          excellent: 85,
        },
      },
    })

    // Register Go
    this.registerLanguage({
      name: 'go',
      extensions: ['go'],
      analyzer: GoAnalyzer,
      defaultRules: [
        'GO_STANDARDS',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'ERROR_HANDLING',
        'PACKAGE_NAMING',
        'UNUSED_VARIABLES',
      ],
      metrics: {
        complexity: {
          high: 12,
          medium: 6,
          low: 1,
        },
        maintainability: {
          poor: 50,
          fair: 70,
          good: 80,
          excellent: 90,
        },
      },
    })

    // Register C++
    this.registerLanguage({
      name: 'cpp',
      extensions: ['cpp', 'cc', 'cxx', 'c++', 'h', 'hpp'],
      analyzer: null as any, // C++ analyzer not implemented yet
      defaultRules: [
        'CPP_STANDARDS',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'MEMORY_MANAGEMENT',
        'INCLUDE_GUARDS',
        'UNUSED_VARIABLES',
      ],
      metrics: {
        complexity: {
          high: 20,
          medium: 10,
          low: 1,
        },
        maintainability: {
          poor: 35,
          fair: 60,
          good: 75,
          excellent: 85,
        },
      },
    })

    // Register Rust
    this.registerLanguage({
      name: 'rust',
      extensions: ['rs'],
      analyzer: RustAnalyzer,
      defaultRules: [
        'RUST_STANDARDS',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'UNSAFE_CODE',
        'LIFETIME_MANAGEMENT',
        'CLONING_ISSUES',
      ],
      metrics: {
        complexity: {
          high: 11,
          medium: 6,
          low: 1,
        },
        maintainability: {
          poor: 55,
          fair: 75,
          good: 85,
          excellent: 95,
        },
      },
    })

    // Register Ruby
    this.registerLanguage({
      name: 'ruby',
      extensions: ['rb'],
      analyzer: RubyAnalyzer,
      defaultRules: [
        'RUBY_STANDARDS',
        'COMPLEXITY_HIGH',
        'METHOD_TOO_LONG',
        'CLASS_TOO_LONG',
        'GLOBAL_VARIABLES',
        'METAPROGRAMMING',
      ],
      metrics: {
        complexity: {
          high: 8,
          medium: 4,
          low: 1,
        },
        maintainability: {
          poor: 45,
          fair: 70,
          good: 80,
          excellent: 90,
        },
      },
    })

    // Register PHP
    this.registerLanguage({
      name: 'php',
      extensions: ['php'],
      analyzer: PHPAnalyzer,
      defaultRules: [
        'PHP_STANDARDS',
        'COMPLEXITY_HIGH',
        'FUNCTION_TOO_LONG',
        'CLASS_TOO_LONG',
        'SECURITY_ISSUES',
        'NAMING_CONVENTIONS',
      ],
      metrics: {
        complexity: {
          high: 12,
          medium: 6,
          low: 1,
        },
        maintainability: {
          poor: 40,
          fair: 65,
          good: 75,
          excellent: 85,
        },
      },
    })
  }

  registerLanguage(config: LanguageConfig): void {
    this.languages.set(config.name, config)

    // Create extension mapping
    config.extensions.forEach(ext => {
      this.extensionMap.set(ext, config.name)
    })
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.languages.keys())
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys())
  }

  detectLanguage(filePath: string): string | null {
    const extension = filePath.split('.').pop()?.toLowerCase()
    if (!extension) {
      return null
    }

    return this.extensionMap.get(extension) || null
  }

  getLanguageConfig(language: string): LanguageConfig | null {
    return this.languages.get(language) || null
  }

  async analyzeFile(filePath: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const language = this.detectLanguage(filePath)
    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`)
    }

    const config = this.getLanguageConfig(language)
    if (!config) {
      throw new Error(`No configuration found for language: ${language}`)
    }

    // Get analyzer instance
    const analyzer = this.getAnalyzer(language)
    if (!analyzer) {
      throw new Error(`No analyzer available for language: ${language}`)
    }

    // Apply language-specific thresholds
    const languageOptions: AnalysisOptions = {
      ...options,
      thresholds: {
        ...config.metrics,
        ...options.thresholds,
      },
      rules: options.rules || config.defaultRules,
    }

    return analyzer.analyzeFile(filePath, languageOptions)
  }

  async analyzeCode(
    code: string,
    language: string,
    filePath?: string,
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult> {
    const config = this.getLanguageConfig(language)
    if (!config) {
      throw new Error(`No configuration found for language: ${language}`)
    }

    // Get analyzer instance
    const analyzer = this.getAnalyzer(language)
    if (!analyzer) {
      throw new Error(`No analyzer available for language: ${language}`)
    }

    // Apply language-specific thresholds
    const languageOptions: AnalysisOptions = {
      ...options,
      thresholds: {
        ...config.metrics,
        ...options.thresholds,
      },
      rules: options.rules || config.defaultRules,
    }

    const tempFilePath = filePath || `temp.${config.extensions[0]}`

    // Override readFile method for in-memory analysis
    const originalReadFile = (analyzer as any).readFile
    ;(analyzer as any).readFile = async () => code

    try {
      return await analyzer.analyzeFile(tempFilePath, languageOptions)
    } finally {
      // Restore original readFile method
      ;(analyzer as any).readFile = originalReadFile
    }
  }

  async analyzeMultipleFiles(
    filePaths: string[],
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = []
    const errors: { filePath: string; error: string }[] = []

    for (const filePath of filePaths) {
      try {
        const result = await this.analyzeFile(filePath, options)
        results.push(result)
      } catch (error) {
        errors.push({
          filePath,
          error: error instanceof Error ? error.message : String(error),
        })
        console.warn(`Failed to analyze ${filePath}:`, error)
      }
    }

    if (errors.length > 0) {
      console.warn(`Analysis completed with ${errors.length} errors:`)
      errors.forEach(err => {
        console.warn(`  - ${err.filePath}: ${err.error}`)
      })
    }

    return results
  }

  getLanguageMetrics(language: string): CodeMetrics | null {
    const config = this.getLanguageConfig(language)
    if (!config) {
      return null
    }

    return {
      linesOfCode: 0,
      complexity: 0,
      maintainability: 100,
      commentLines: 0,
      commentPercentage: 0,
      functionCount: 0,
      averageFunctionLength: 0,
      dependencies: [],
      technicalDebt: 0,
    }
  }

  getDefaultRules(language: string): string[] {
    const config = this.getLanguageConfig(language)
    return config?.defaultRules || []
  }

  validateLanguage(language: string): boolean {
    return this.languages.has(language)
  }

  private getAnalyzer(language: string): BaseCodeAnalyzer | null {
    const config = this.getLanguageConfig(language)
    if (!config || !config.analyzer) {
      return null
    }

    // Create a new instance of the analyzer
    return new config.analyzer()
  }

  setAnalyzer(language: string, analyzer: BaseCodeAnalyzer): void {
    const config = this.getLanguageConfig(language)
    if (config) {
      config.analyzer = analyzer.constructor as new () => BaseCodeAnalyzer
    }
  }

  getLanguageInfo(language: string): {
    name: string
    extensions: string[]
    defaultRules: string[]
    metrics: {
      complexity: { high: number; medium: number; low: number }
      maintainability: { poor: number; fair: number; good: number; excellent: number }
    }
  } | null {
    const config = this.getLanguageConfig(language)
    if (!config) {
      return null
    }

    return {
      name: config.name,
      extensions: config.extensions,
      defaultRules: config.defaultRules,
      metrics: config.metrics,
    }
  }

  generateLanguageReport(): string {
    let report = '# Multi-Language Support Framework Report\n\n'
    report += `**Supported Languages:** ${this.getSupportedLanguages().length}\n`
    report += `**Supported Extensions:** ${this.getSupportedExtensions().length}\n\n`

    report += '## Language Configurations\n\n'

    for (const [language, config] of this.languages.entries()) {
      report += `### ${language.charAt(0).toUpperCase() + language.slice(1)}\n`
      report += `- **Extensions:** ${config.extensions.join(', ')}\n`
      report += `- **Default Rules:** ${config.defaultRules.join(', ')}\n`
      report += `- **Complexity Thresholds:** High=${config.metrics.complexity.high}, Medium=${config.metrics.complexity.medium}\n`
      report += `- **Maintainability Thresholds:** Poor=${config.metrics.maintainability.poor}, Fair=${config.metrics.maintainability.fair}\n`
      report += `- **Analyzer Available:** ${config.analyzer ? 'Yes' : 'No'}\n\n`
    }

    return report
  }
}
