import { describe, it, expect, beforeEach } from '@jest/globals'
import { BaseCodeAnalyzer, AnalysisOptions } from '../analysis/BaseCodeAnalyzer'

// Mock implementation for testing
class TestCodeAnalyzer extends BaseCodeAnalyzer {
  constructor(options?: AnalysisOptions) {
    super(options)
  }

  async initialize(): Promise<void> {
    // Mock initialization
  }

  protected override async readFile(_filePath: string): Promise<string> {
    return `function test() {
  if (condition) {
    return true;
  }
  return false;
}`
  }
}

describe('BaseCodeAnalyzer', () => {
  let analyzer: TestCodeAnalyzer

  beforeEach(() => {
    analyzer = new TestCodeAnalyzer({
      includeSuggestions: true,
      skipDependencies: false,
      thresholds: {
        complexity: 10,
        maintainability: 70,
      },
    })
  })

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const defaultAnalyzer = new TestCodeAnalyzer()
      expect((defaultAnalyzer as any).options.includeSuggestions).toBe(true)
      expect((defaultAnalyzer as any).options.skipDependencies).toBe(false)
    })

    it('should merge provided options with defaults', () => {
      const customAnalyzer = new TestCodeAnalyzer({
        includeSuggestions: false,
        thresholds: { complexity: 15 },
      })
      expect((customAnalyzer as any).options.includeSuggestions).toBe(false)
      expect((customAnalyzer as any).options.skipDependencies).toBe(false)
      expect((customAnalyzer as any).options.thresholds?.complexity).toBe(15)
    })
  })

  describe('Complexity Calculation', () => {
    it('should calculate basic complexity', () => {
      const simpleCode = 'function test() { return true; }'
      const complexity = (analyzer as any).calculateComplexity(simpleCode)
      expect(complexity).toBe(1)
    })

    it('should increase complexity for control structures', () => {
      const complexCode = `function test() {
  if (condition) {
    return true;
  } else if (other) {
    return false;
  }
  for (let i = 0; i < 10; i++) {
    while (true) {
      break;
    }
  }
}`
      const complexity = (analyzer as any).calculateComplexity(complexCode)
      expect(complexity).toBeGreaterThan(1)
    })

    it('should handle empty code', () => {
      const complexity = (analyzer as any).calculateComplexity('')
      expect(complexity).toBe(1)
    })
  })

  describe('Maintainability Calculation', () => {
    it('should calculate maintainability index', () => {
      const metrics = {
        complexity: 5,
        maintainability: 0,
        linesOfCode: 50,
        commentLines: 10,
        commentPercentage: 20,
        functionCount: 3,
        averageFunctionLength: 16,
        dependencies: [],
        technicalDebt: 0,
      }

      const maintainability = (analyzer as any).calculateMaintainability(metrics)
      expect(maintainability).toBeGreaterThan(0)
      expect(maintainability).toBeLessThanOrEqual(100)
    })

    it('should handle high complexity', () => {
      const metrics = {
        complexity: 50,
        maintainability: 0,
        linesOfCode: 1000,
        commentLines: 50,
        commentPercentage: 5,
        functionCount: 10,
        averageFunctionLength: 100,
        dependencies: [],
        technicalDebt: 0,
      }

      const maintainability = (analyzer as any).calculateMaintainability(metrics)
      expect(maintainability).toBeLessThan(50)
    })
  })

  describe('Technical Debt Calculation', () => {
    it('should calculate zero technical debt for good metrics', () => {
      const metrics = {
        complexity: 5,
        maintainability: 80,
        linesOfCode: 100,
        commentLines: 30,
        commentPercentage: 30,
        functionCount: 5,
        averageFunctionLength: 20,
        dependencies: [],
        technicalDebt: 0,
      }

      const debt = (analyzer as any).calculateTechnicalDebt(metrics)
      expect(debt).toBe(0)
    })

    it('should calculate technical debt for poor metrics', () => {
      const metrics = {
        complexity: 20,
        maintainability: 30,
        linesOfCode: 500,
        commentLines: 10,
        commentPercentage: 2,
        functionCount: 2,
        averageFunctionLength: 250,
        dependencies: [],
        technicalDebt: 0,
      }

      const debt = (analyzer as any).calculateTechnicalDebt(metrics)
      expect(debt).toBeGreaterThan(0)
    })
  })

  describe('Language Support', () => {
    it('should report no supported languages initially', () => {
      const languages = analyzer.getSupportedLanguages()
      expect(languages).toEqual([])
    })

    it('should check language support', () => {
      expect(analyzer.isLanguageSupported('javascript')).toBe(false)
      expect(analyzer.isLanguageSupported('python')).toBe(false)
    })

    it('should detect language from file extension', () => {
      const language = (analyzer as any).detectLanguage('test.js')
      expect(language).toBeNull()
    })
  })

  describe('Options Validation', () => {
    it('should validate correct thresholds', () => {
      const validOptions = {
        thresholds: {
          complexity: 10,
          maintainability: 70,
          coverage: 80,
        },
      }

      expect(() => {
        ;(analyzer as any).validateOptions(validOptions)
      }).not.toThrow()
    })

    it('should reject invalid complexity threshold', () => {
      const invalidOptions = {
        thresholds: {
          complexity: 0,
        },
      }

      expect(() => {
        ;(analyzer as any).validateOptions(invalidOptions)
      }).toThrow('Complexity threshold must be at least 1')
    })

    it('should reject invalid maintainability threshold', () => {
      const invalidOptions = {
        thresholds: {
          maintainability: 150,
        },
      }

      expect(() => {
        ;(analyzer as any).validateOptions(invalidOptions)
      }).toThrow('Maintainability threshold must be between 0 and 100')
    })

    it('should reject invalid coverage threshold', () => {
      const invalidOptions = {
        thresholds: {
          coverage: -10,
        },
      }

      expect(() => {
        ;(analyzer as any).validateOptions(invalidOptions)
      }).toThrow('Coverage threshold must be between 0 and 100')
    })
  })

  describe('File Analysis', () => {
    it('should throw error for unsupported file types', async () => {
      await expect(analyzer.analyzeFile('test.unknown')).rejects.toThrow(
        'Unsupported file type: test.unknown'
      )
    })

    it('should handle multiple file analysis', async () => {
      const results = await analyzer.analyzeFiles(['test.js', 'test.py'])
      expect(results).toEqual([])
      // Should continue despite errors for individual files
    })
  })
})
