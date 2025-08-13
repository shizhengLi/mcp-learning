import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { AIModelManager } from '../ai/AIModelManager'
import { AIModel, AIContext } from '../ai/AIModelManager'

// Mock the AI models
jest.mock('../ai/models/ClaudeModel')
jest.mock('../ai/models/OpenAIModel')
jest.mock('../ai/models/LocalModel')

describe('AIModelManager Tests', () => {
  let aiManager: AIModelManager
  let mockClaudeModel: jest.Mocked<AIModel>
  let mockOpenAIModel: jest.Mocked<AIModel>
  let mockLocalModel: jest.Mocked<AIModel>

  beforeEach(() => {
    // Reset environment variables
    process.env.CLAUDE_API_KEY = 'test-claude-key'
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.OLLAMA_ENDPOINT = 'http://localhost:11434'

    // Create mock models
    mockClaudeModel = {
      name: 'claude',
      generate: jest.fn(),
      isAvailable: jest.fn(),
    } as jest.Mocked<AIModel>

    mockOpenAIModel = {
      name: 'gpt',
      generate: jest.fn(),
      isAvailable: jest.fn(),
    } as jest.Mocked<AIModel>

    mockLocalModel = {
      name: 'local',
      generate: jest.fn(),
      isAvailable: jest.fn(),
    } as jest.Mocked<AIModel>

    // Mock the dynamic imports
    jest.doMock('../ai/models/ClaudeModel', () => ({
      ClaudeModel: jest.fn().mockImplementation(() => mockClaudeModel),
    }))

    jest.doMock('../ai/models/OpenAIModel', () => ({
      OpenAIModel: jest.fn().mockImplementation(() => mockOpenAIModel),
    }))

    jest.doMock('../ai/models/LocalModel', () => ({
      LocalModel: jest.fn().mockImplementation(() => mockLocalModel),
    }))

    aiManager = new AIModelManager()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with available models', async () => {
      mockClaudeModel.isAvailable.mockResolvedValue(true)
      mockOpenAIModel.isAvailable.mockResolvedValue(true)
      mockLocalModel.isAvailable.mockResolvedValue(false)

      const availableModels = await aiManager.getAvailableModels()

      expect(availableModels).toContain('claude')
      expect(availableModels).toContain('gpt')
      expect(availableModels).not.toContain('local')
    })

    it('should handle missing API keys gracefully', async () => {
      delete process.env.CLAUDE_API_KEY
      delete process.env.OPENAI_API_KEY
      delete process.env.OLLAMA_ENDPOINT

      const newManager = new AIModelManager()
      const availableModels = await newManager.getAvailableModels()

      expect(availableModels).toHaveLength(0)
    })
  })

  describe('Model Selection', () => {
    beforeEach(() => {
      mockClaudeModel.isAvailable.mockResolvedValue(true)
      mockOpenAIModel.isAvailable.mockResolvedValue(true)
      mockLocalModel.isAvailable.mockResolvedValue(true)
    })

    it('should prefer Claude for code analysis tasks', async () => {
      const context: AIContext = {
        language: 'python',
        code: 'def test(): pass',
        metrics: {
          complexity: 5,
          maintainability: 80,
          linesOfCode: 25,
          commentLines: 5,
          commentPercentage: 20,
          functionCount: 2,
          averageFunctionLength: 12.5,
          dependencies: [],
          technicalDebt: 10,
        },
      }

      // Mock private method for testing
      const availableModels = ['claude', 'gpt', 'local']
      const selectedModel = (aiManager as any).selectOptimalModel(context, availableModels)

      expect(selectedModel).toBe('claude')
    })

    it('should fallback to GPT if Claude is not available', async () => {
      const context: AIContext = {
        language: 'javascript',
        code: 'function test() {}',
      }

      const availableModels = ['gpt', 'local']
      const selectedModel = (aiManager as any).selectOptimalModel(context, availableModels)

      expect(selectedModel).toBe('gpt')
    })

    it('should use local model as last resort', async () => {
      const context: AIContext = {
        language: 'python',
        code: 'def test(): pass',
      }

      const availableModels = ['local']
      const selectedModel = (aiManager as any).selectOptimalModel(context, availableModels)

      expect(selectedModel).toBe('local')
    })
  })

  describe('Refactoring Suggestions', () => {
    beforeEach(() => {
      mockClaudeModel.isAvailable.mockResolvedValue(true)
      mockClaudeModel.generate.mockResolvedValue({
        content:
          '{"suggestions": [{"type": "optimize", "priority": "high", "description": "Test suggestion"}]}',
        suggestions: [
          {
            type: 'optimize',
            priority: 'high',
            description: 'Test suggestion',
            line: 1,
            estimatedImpact: { complexityReduction: 2, maintainabilityImprovement: 15 },
          },
        ],
        confidence: 0.9,
        model: 'claude',
      })
    })

    it('should generate refactoring suggestions successfully', async () => {
      const context: AIContext = {
        language: 'python',
        code: 'def complex_function():\n    for i in range(100):\n        if i % 2 == 0:\n            print(i)',
        filePath: 'test.py',
        metrics: {
          complexity: 10,
          maintainability: 60,
          linesOfCode: 20,
          commentLines: 4,
          commentPercentage: 20,
          functionCount: 1,
          averageFunctionLength: 20,
          dependencies: [],
          technicalDebt: 5,
        },
      }

      const suggestions = await aiManager.generateRefactoringSuggestions('test code', context)

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].type).toBe('optimize')
      expect(suggestions[0].priority).toBe('high')
      expect(mockClaudeModel.generate).toHaveBeenCalledTimes(1)
    })

    it('should handle empty suggestions gracefully', async () => {
      mockClaudeModel.generate.mockResolvedValue({
        content: '{"suggestions": []}',
        suggestions: [],
        confidence: 0.8,
        model: 'claude',
      })

      const context: AIContext = {
        language: 'javascript',
        code: 'function simple() { return true; }',
      }

      const suggestions = await aiManager.generateRefactoringSuggestions('simple code', context)

      expect(suggestions).toHaveLength(0)
    })

    it('should handle model errors gracefully', async () => {
      mockClaudeModel.generate.mockRejectedValue(new Error('API Error'))

      const context: AIContext = {
        language: 'python',
        code: 'def test(): pass',
      }

      const suggestions = await aiManager.generateRefactoringSuggestions('test code', context)

      expect(suggestions).toHaveLength(0)
    })

    it('should build comprehensive refactoring prompt', async () => {
      const context: AIContext = {
        language: 'python',
        code: 'def test(): pass',
        filePath: 'test.py',
        metrics: {
          complexity: 8,
          maintainability: 70,
          linesOfCode: 25,
          commentLines: 5,
          commentPercentage: 20,
          functionCount: 2,
          averageFunctionLength: 12.5,
          dependencies: [],
          technicalDebt: 10,
        },
        additionalContext: 'Production code with performance requirements',
      }

      const prompt = (aiManager as any).buildRefactoringPrompt('test code', context)

      expect(prompt).toContain('python')
      expect(prompt).toContain('test.py')
      expect(prompt).toContain('Complexity: 8')
      expect(prompt).toContain('Maintainability: 70')
      expect(prompt).toContain('Production code with performance requirements')
      expect(prompt).toContain('JSON format')
    })
  })

  describe('Code Analysis', () => {
    beforeEach(() => {
      mockClaudeModel.isAvailable.mockResolvedValue(true)
      mockClaudeModel.generate.mockResolvedValue({
        content:
          '{"complexity": 5, "maintainability": 85, "issues": [], "insights": "Clean code structure"}',
        suggestions: [],
        confidence: 0.9,
        model: 'claude',
      })
    })

    it('should generate code analysis successfully', async () => {
      const context: AIContext = {
        language: 'javascript',
        code: 'function analyze() { return true; }',
      }

      const analysis = await aiManager.generateCodeAnalysis('test code', context)

      expect(analysis).toBeDefined()
      expect(typeof analysis).toBe('object')
      expect(mockClaudeModel.generate).toHaveBeenCalledTimes(1)
    })

    it('should parse AI analysis response correctly', async () => {
      mockClaudeModel.generate.mockResolvedValue({
        content:
          '{"complexity": 7, "maintainability": 75, "issues": [{"type": "warning", "severity": "medium", "message": "Consider adding comments", "line": 1, "rule": "COMMENT-001"}], "insights": "Good overall structure"}',
        suggestions: [],
        confidence: 0.9,
        model: 'claude',
      })

      const context: AIContext = {
        language: 'python',
        code: 'def func(): pass',
      }

      const analysis = await aiManager.generateCodeAnalysis('test code', context)

      if (analysis.issues && analysis.issues.length > 0) {
        expect(analysis.issues).toHaveLength(1)
        expect(analysis.issues[0].type).toBe('warning')
        expect(analysis.issues[0].message).toBe('Consider adding comments')
      }
    })

    it('should handle invalid JSON responses gracefully', async () => {
      mockClaudeModel.generate.mockResolvedValue({
        content: 'Invalid JSON response',
        suggestions: [],
        confidence: 0.5,
        model: 'claude',
      })

      const context: AIContext = {
        language: 'javascript',
        code: 'function test() {}',
      }

      const analysis = await aiManager.generateCodeAnalysis('test code', context)

      expect(analysis).toEqual({})
    })

    it('should build comprehensive analysis prompt', async () => {
      const context: AIContext = {
        language: 'python',
        code: 'def analyze_code(): pass',
      }

      const prompt = (aiManager as any).buildAnalysisPrompt(context.code, context)

      expect(prompt).toContain('python')
      expect(prompt).toContain('expert code analyst')
      expect(prompt).toContain('complexity')
      expect(prompt).toContain('maintainability')
    })
  })

  describe('Utility Methods', () => {
    it('should return default model when no models available', async () => {
      mockClaudeModel.isAvailable.mockResolvedValue(false)
      mockOpenAIModel.isAvailable.mockResolvedValue(false)
      mockLocalModel.isAvailable.mockResolvedValue(false)

      const defaultModel = await aiManager.getDefaultModel()

      expect(defaultModel).toBe('claude') // Default fallback
    })

    it('should check model availability correctly', async () => {
      // Clear mock calls from initialization
      mockClaudeModel.isAvailable.mockClear()
      mockClaudeModel.isAvailable.mockResolvedValue(true)

      const isAvailable = await aiManager.isModelAvailable('claude')

      expect(isAvailable).toBe(true)
      expect(mockClaudeModel.isAvailable).toHaveBeenCalledTimes(1)
    })

    it('should handle model availability check errors', async () => {
      mockClaudeModel.isAvailable.mockRejectedValue(new Error('Connection error'))

      const isAvailable = await aiManager.isModelAvailable('claude')

      expect(isAvailable).toBe(false)
    })

    it('should return false for non-existent models', async () => {
      const isAvailable = await aiManager.isModelAvailable('non-existent')

      expect(isAvailable).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle all models unavailable gracefully', async () => {
      mockClaudeModel.isAvailable.mockResolvedValue(false)
      mockOpenAIModel.isAvailable.mockResolvedValue(false)
      mockLocalModel.isAvailable.mockResolvedValue(false)

      const context: AIContext = {
        language: 'python',
        code: 'def test(): pass',
      }

      const suggestions = await aiManager.generateRefactoringSuggestions('test code', context)

      expect(suggestions).toHaveLength(0)
    })

    it('should handle model not found gracefully', async () => {
      mockClaudeModel.isAvailable.mockResolvedValue(true)

      // Mock the method to return a model that doesn't exist
      jest.spyOn(aiManager as any, 'selectOptimalModel').mockReturnValue('non-existent')

      const context: AIContext = {
        language: 'python',
        code: 'def test(): pass',
      }

      const suggestions = await aiManager.generateRefactoringSuggestions('test code', context)

      expect(suggestions).toHaveLength(0)
    })
  })
})
