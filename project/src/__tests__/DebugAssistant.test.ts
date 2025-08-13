import { describe, it, expect, beforeEach } from '@jest/globals'
import { DebugAssistant } from '../testing/DebugAssistant'

describe('DebugAssistant', () => {
  let assistant: DebugAssistant

  beforeEach(() => {
    assistant = new DebugAssistant({})
  })

  describe('Error Analysis', () => {
    it('should analyze TypeError with context', async () => {
      const result = await assistant.analyzeError(
        'TypeError: Cannot read property \'name\' of undefined',
        'const user = getUser(); console.log(user.name);',
        'at getUserInfo (src/user.ts:45:23)'
      )

      expect(result.errorType).toBe('TypeError')
      expect(result.severity).toBeDefined()
      expect(['critical', 'high', 'medium', 'low']).toContain(result.severity)
      expect(result.rootCause).toBeDefined()
      expect(result.suggestedFix).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
      expect(result.relatedFiles).toBeDefined()
      expect(Array.isArray(result.relatedFiles)).toBe(true)
      expect(result.preventionTips).toBeDefined()
      expect(Array.isArray(result.preventionTips)).toBe(true)
    })

    it('should analyze NetworkError', async () => {
      const result = await assistant.analyzeError(
        'NetworkError: Failed to fetch',
        'fetch(\'/api/users\')'
      )

      expect(result.errorType).toBe('NetworkError')
      expect(result.severity).toBeDefined()
      expect(result.suggestedFix).toBeDefined()
    })

    it('should analyze DatabaseError', async () => {
      const result = await assistant.analyzeError(
        'DatabaseError: Connection timeout',
        'db.query(\'SELECT * FROM users\')'
      )

      expect(result.errorType).toBe('DatabaseError')
      expect(result.severity).toBeDefined()
    })

    it('should analyze AuthenticationError', async () => {
      const result = await assistant.analyzeError(
        'AuthenticationError: Invalid token',
        'auth.verifyToken(token)'
      )

      expect(result.errorType).toBe('AuthenticationError')
      expect(result.severity).toBeDefined()
    })

    it('should analyze ValidationError', async () => {
      const result = await assistant.analyzeError(
        'ValidationError: Required field missing',
        'schema.validate(data)'
      )

      expect(result.errorType).toBe('ValidationError')
      expect(result.severity).toBeDefined()
    })

    it('should handle unknown error types', async () => {
      const result = await assistant.analyzeError(
        'SomeUnknownError: Something went wrong'
      )

      expect(result.errorType).toBe('UnknownError')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should analyze error without context', async () => {
      const result = await assistant.analyzeError('TypeError: Cannot read property of undefined')

      expect(result.errorType).toBe('TypeError')
      expect(result.rootCause).toBeDefined()
      expect(result.suggestedFix).toBeDefined()
    })

    it('should assess error severity correctly', async () => {
      const criticalResult = await assistant.analyzeError('Stack overflow detected')
      expect(['critical', 'high']).toContain(criticalResult.severity)

      const mediumResult = await assistant.analyzeError('TypeError: something is undefined')
      expect(['medium', 'low']).toContain(mediumResult.severity)
    })
  })

  describe('Test Failure Analysis', () => {
    it('should analyze test failures', async () => {
      const testResults = {
        failures: [
          { name: 'should authenticate user', error: 'Expected 200 but got 401' },
          { name: 'should create user', error: 'Timeout exceeded' },
        ],
      }

      const result = await assistant.analyzeTestFailures(testResults)

      expect(result.failures).toBeDefined()
      expect(Array.isArray(result.failures)).toBe(true)
      expect(result.failures.length).toBeGreaterThan(0)
      expect(result.patterns).toBeDefined()
      expect(Array.isArray(result.patterns)).toBe(true)
      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)

      const failure = result.failures[0]
      expect(failure.testName).toBeDefined()
      expect(failure.error).toBeDefined()
      expect(failure.suggestedFix).toBeDefined()
      expect(['high', 'medium', 'low']).toContain(failure.priority)
      expect(failure.estimatedEffort).toBeGreaterThan(0)

      const pattern = result.patterns[0]
      expect(pattern.pattern).toBeDefined()
      expect(pattern.frequency).toBeGreaterThan(0)
      expect(pattern.suggestedAction).toBeDefined()
    })

    it('should handle empty test failures', async () => {
      const testResults = { failures: [] }

      const result = await assistant.analyzeTestFailures(testResults)

      expect(result.failures).toBeDefined()
      expect(Array.isArray(result.failures)).toBe(true)
      expect(result.patterns).toBeDefined()
      expect(Array.isArray(result.patterns)).toBe(true)
      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)
    })
  })

  describe('Error Simulation', () => {
    it('should simulate errors with medium intensity', async () => {
      const errorTypes = ['NetworkError', 'DatabaseError']

      const result = await assistant.simulateErrors(errorTypes, '/src/services', 'medium')

      expect(result.simulatedErrors).toBeDefined()
      expect(Array.isArray(result.simulatedErrors)).toBe(true)
      expect(result.simulatedErrors).toHaveLength(2)
      expect(result.simulationResults).toBeDefined()
      expect(result.simulationResults.totalSimulated).toBe(2)
      expect(result.simulationResults.successfullyTriggered).toBeGreaterThanOrEqual(0)
      expect(result.simulationResults.successfullyTriggered).toBeLessThanOrEqual(2)
      expect(result.simulationResults.coverage).toBeGreaterThanOrEqual(0)
      expect(result.simulationResults.coverage).toBeLessThanOrEqual(100)

      const simulatedError = result.simulatedErrors[0]
      expect(simulatedError.type).toBeDefined()
      expect(simulatedError.description).toBeDefined()
      expect(typeof simulatedError.triggered).toBe('boolean')
      expect(simulatedError.behavior).toBeDefined()
    })

    it('should simulate errors with low intensity', async () => {
      const result = await assistant.simulateErrors(['NetworkError'], '/src', 'low')

      expect(result.simulatedErrors).toHaveLength(1)
      expect(result.simulatedErrors[0].behavior).toContain('minimal')
    })

    it('should simulate errors with high intensity', async () => {
      const result = await assistant.simulateErrors(['NetworkError'], '/src', 'high')

      expect(result.simulatedErrors).toHaveLength(1)
      expect(result.simulatedErrors[0].behavior).toContain('high')
    })

    it('should handle empty error types', async () => {
      const result = await assistant.simulateErrors([], '/src')

      expect(result.simulatedErrors).toHaveLength(0)
      expect(result.simulationResults.totalSimulated).toBe(0)
    })
  })

  describe('Fix Validation', () => {
    it('should validate fixes with comprehensive level', async () => {
      const fixes = [
        {
          description: 'Add null check',
          code: 'if (user) { console.log(user.name); }',
          targetFile: 'src/user.ts',
        },
      ]

      const result = await assistant.validateFixes(fixes, '/tests', 'comprehensive')

      expect(result.validationResults).toBeDefined()
      expect(Array.isArray(result.validationResults)).toBe(true)
      expect(result.validationResults).toHaveLength(1)
      expect(result.overallStatus).toBeDefined()
      expect(['all-valid', 'partial', 'needs-attention']).toContain(result.overallStatus)
      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)

      const validation = result.validationResults[0]
      expect(validation.fix).toBe('Add null check')
      expect(['valid', 'invalid', 'needs-review']).toContain(validation.status)
      expect(validation.confidence).toBeGreaterThan(0)
      expect(validation.confidence).toBeLessThanOrEqual(1)
      expect(validation.issues).toBeDefined()
      expect(Array.isArray(validation.issues)).toBe(true)
    })

    it('should validate fixes with basic level', async () => {
      const fixes = [
        {
          description: 'Simple fix',
          code: 'console.log("hello")',
          targetFile: 'src/app.ts',
        },
      ]

      const result = await assistant.validateFixes(fixes, '/tests', 'basic')

      expect(result.validationResults).toHaveLength(1)
      expect(result.overallStatus).toBeDefined()
    })

    it('should handle multiple fixes', async () => {
      const fixes = [
        {
          description: 'Fix 1',
          code: 'code1',
          targetFile: 'file1.ts',
        },
        {
          description: 'Fix 2',
          code: 'code2',
          targetFile: 'file2.ts',
        },
      ]

      const result = await assistant.validateFixes(fixes, '/tests')

      expect(result.validationResults).toHaveLength(2)
      expect(result.overallStatus).toBeDefined()
    })

    it('should handle empty fixes', async () => {
      const result = await assistant.validateFixes([], '/tests')

      expect(result.validationResults).toHaveLength(0)
      expect(result.overallStatus).toBe('all-valid')
    })
  })

  describe('Debugging Strategy', () => {
    it('should suggest performance debugging strategy', async () => {
      const result = await assistant.suggestDebuggingStrategy('Application is slow')

      expect(result.strategy).toBe('Performance Analysis')
      expect(result.steps).toBeDefined()
      expect(Array.isArray(result.steps)).toBe(true)
      expect(result.steps.length).toBeGreaterThan(0)
      expect(result.estimatedTime).toBeGreaterThan(0)
      expect(result.successProbability).toBeGreaterThan(0)
      expect(result.successProbability).toBeLessThanOrEqual(1)

      const step = result.steps[0]
      expect(step.step).toBeDefined()
      expect(step.description).toBeDefined()
      expect(step.tools).toBeDefined()
      expect(Array.isArray(step.tools)).toBe(true)
      expect(step.expectedOutcome).toBeDefined()
    })

    it('should suggest functional debugging strategy', async () => {
      const result = await assistant.suggestDebuggingStrategy('Bug in user authentication')

      expect(result.strategy).toBe('Functional Debugging')
      expect(result.steps).toBeDefined()
      expect(result.estimatedTime).toBeGreaterThan(0)
    })

    it('should handle unknown problem types', async () => {
      const result = await assistant.suggestDebuggingStrategy('Unknown issue')

      expect(result.strategy).toBeDefined()
      expect(result.steps).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle empty error message', async () => {
      const result = await assistant.analyzeError('')

      expect(result.errorType).toBe('UnknownError')
      expect(result.rootCause).toBeDefined()
      expect(result.suggestedFix).toBeDefined()
    })

    it('should handle special characters in error message', async () => {
      const result = await assistant.analyzeError('Error: Special chars @#$%^&*()')

      expect(result.errorType).toBe('UnknownError')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should handle very long error messages', async () => {
      const longError = 'Error: '.repeat(1000) + 'Something went wrong'
      const result = await assistant.analyzeError(longError)

      expect(result.errorType).toBeDefined()
      expect(result.rootCause).toBeDefined()
    })

    it('should handle fixes with missing properties', async () => {
      const incompleteFixes = [{}]

      const result = await assistant.validateFixes(incompleteFixes as any, '/tests')

      expect(result.validationResults).toHaveLength(1)
      expect(result.overallStatus).toBeDefined()
    })
  })
})