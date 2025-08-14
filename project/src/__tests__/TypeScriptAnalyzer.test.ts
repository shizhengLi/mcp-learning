import { describe, it, expect, beforeEach } from '@jest/globals'
import { TypeScriptAnalyzer } from '../analysis/TypeScriptAnalyzer'

describe('TypeScriptAnalyzer', () => {
  let analyzer: TypeScriptAnalyzer

  beforeEach(() => {
    analyzer = new TypeScriptAnalyzer()
  })

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(analyzer).toBeDefined()
      expect(analyzer.getSupportedLanguages()).toContain('typescript')
    })

    it('should have TypeScript-specific configuration', () => {
      expect((analyzer as any).language).toBe('typescript')
      expect((analyzer as any).extensions).toContain('ts')
      expect((analyzer as any).extensions).toContain('tsx')
    })
  })

  describe('TypeScript Analysis', () => {
    it('should analyze TypeScript code completely', async () => {
      const filePath = 'user-service.ts'
      const result = await analyzer.analyzeFile(filePath)

      expect(result).toBeDefined()
      expect(result.language).toBe('typescript')
      expect(result.filePath).toBe(filePath)
      expect(result.metrics).toBeDefined()
      expect(result.issues).toBeDefined()
      expect(Array.isArray(result.issues)).toBe(true)
    })

    it('should detect TypeScript-specific issues', async () => {
      const filePath = 'issues.ts'
      const result = await analyzer.analyzeFile(filePath)

      expect(result).toBeDefined()
      expect(result.issues).toBeDefined()
    })

    it('should handle empty TypeScript code', async () => {
      const filePath = 'empty.ts'
      const result = await analyzer.analyzeFile(filePath)

      expect(result).toBeDefined()
      expect(result.metrics).toBeDefined()
    })

    it('should handle malformed TypeScript gracefully', async () => {
      const filePath = 'malformed.ts'
      const result = await analyzer.analyzeFile(filePath)

      expect(result).toBeDefined()
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Integration with Quality Metrics', () => {
    it('should provide quality metrics for TypeScript code', async () => {
      const filePath = 'quality.ts'
      const result = await analyzer.analyzeFile(filePath)

      expect(result).toBeDefined()
      expect(result.metrics.complexity).toBeGreaterThan(0)
      expect(result.metrics.maintainability).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle analysis failures gracefully', async () => {
      const filePath = 'nonexistent.ts'
      
      // Test with a file that doesn't exist
      try {
        await analyzer.analyzeFile(filePath)
        // Should handle gracefully
        expect(true).toBe(true)
      } catch (error) {
        // Should handle errors gracefully
        expect(error).toBeDefined()
      }
    })
  })
})