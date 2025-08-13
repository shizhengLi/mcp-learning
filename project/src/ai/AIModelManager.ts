import { AnalysisResult, RefactoringSuggestion, CodeMetrics } from './BaseCodeAnalyzer';

export interface AIModel {
  name: string;
  generate(prompt: string, context?: AIContext): Promise<AIResponse>;
  isAvailable(): Promise<boolean>;
}

export interface AIContext {
  language: string;
  code: string;
  filePath?: string;
  metrics?: CodeMetrics;
  additionalContext?: string;
}

export interface AIResponse {
  content: string;
  suggestions: RefactoringSuggestion[];
  confidence: number;
  model: string;
}

export interface AIModelConfig {
  apiKey?: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export class AIModelManager {
  private models: Map<string, AIModel> = new Map();
  private defaultModel: string = 'claude';

  constructor() {
    this.initializeModels();
  }

  private async initializeModels(): Promise<void> {
    // Initialize Claude model
    if (process.env.CLAUDE_API_KEY) {
      try {
        const { ClaudeModel } = await import('./models/ClaudeModel');
        this.models.set('claude', new ClaudeModel({
          apiKey: process.env.CLAUDE_API_KEY,
          model: 'claude-3-sonnet-20240229',
          maxTokens: 1000,
          temperature: 0.3
        }));
      } catch (error) {
        console.warn('Failed to initialize Claude model:', error);
      }
    }

    // Initialize OpenAI model
    if (process.env.OPENAI_API_KEY) {
      try {
        const { OpenAIModel } = await import('./models/OpenAIModel');
        this.models.set('gpt', new OpenAIModel({
          apiKey: process.env.OPENAI_API_KEY,
          model: 'gpt-4-turbo',
          maxTokens: 1000,
          temperature: 0.3
        }));
      } catch (error) {
        console.warn('Failed to initialize OpenAI model:', error);
      }
    }

    // Initialize local model (Ollama)
    if (process.env.OLLAMA_ENDPOINT) {
      try {
        const { LocalModel } = await import('./models/LocalModel');
        this.models.set('local', new LocalModel({
          endpoint: process.env.OLLAMA_ENDPOINT,
          model: 'codellama',
          maxTokens: 1000,
          temperature: 0.3
        }));
      } catch (error) {
        console.warn('Failed to initialize local model:', error);
      }
    }

    // Set default model based on availability
    const availableModels = await this.getAvailableModels();
    if (availableModels.length > 0) {
      this.defaultModel = availableModels[0];
    }
  }

  async getAvailableModels(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, model] of this.models.entries()) {
      try {
        if (await model.isAvailable()) {
          available.push(name);
        }
      } catch (error) {
        console.warn(`Model ${name} is not available:`, error);
      }
    }
    
    return available;
  }

  async generateRefactoringSuggestions(
    code: string,
    context: AIContext
  ): Promise<RefactoringSuggestion[]> {
    const availableModels = await this.getAvailableModels();
    
    if (availableModels.length === 0) {
      console.warn('No AI models available for refactoring suggestions');
      return [];
    }

    const selectedModel = this.selectOptimalModel(context, availableModels);
    const model = this.models.get(selectedModel);
    
    if (!model) {
      console.warn(`Selected model ${selectedModel} not found`);
      return [];
    }

    try {
      const prompt = this.buildRefactoringPrompt(code, context);
      const response = await model.generate(prompt, context);
      
      return response.suggestions;
    } catch (error) {
      console.error('Error generating AI refactoring suggestions:', error);
      return [];
    }
  }

  async generateCodeAnalysis(
    code: string,
    context: AIContext
  ): Promise<Partial<AnalysisResult>> {
    const availableModels = await this.getAvailableModels();
    
    if (availableModels.length === 0) {
      console.warn('No AI models available for code analysis');
      return {};
    }

    const selectedModel = this.selectOptimalModel(context, availableModels);
    const model = this.models.get(selectedModel);
    
    if (!model) {
      console.warn(`Selected model ${selectedModel} not found`);
      return {};
    }

    try {
      const prompt = this.buildAnalysisPrompt(code, context);
      const response = await model.generate(prompt, context);
      
      return this.parseAnalysisResponse(response.content);
    } catch (error) {
      console.error('Error generating AI code analysis:', error);
      return {};
    }
  }

  private selectOptimalModel(context: AIContext, availableModels: string[]): string {
    // Simple selection logic - can be enhanced based on task complexity
    if (availableModels.includes('claude')) {
      return 'claude'; // Claude is good for code analysis
    }
    
    if (availableModels.includes('gpt')) {
      return 'gpt'; // GPT is good for general tasks
    }
    
    if (availableModels.includes('local')) {
      return 'local'; // Fallback to local model
    }
    
    return availableModels[0] || this.defaultModel;
  }

  private buildRefactoringPrompt(code: string, context: AIContext): string {
    return `You are an expert software engineer specializing in code refactoring and optimization. 

Analyze the following ${context.language} code and provide specific refactoring suggestions to improve code quality, maintainability, and performance.

Code:
\`\`\`${context.language}
${code}
\`\`\`

Context:
- File: ${context.filePath || 'unknown'}
- Language: ${context.language}
- Complexity: ${context.metrics?.complexity || 'unknown'}
- Maintainability: ${context.metrics?.maintainability || 'unknown'}/100
${context.additionalContext ? `- Additional Context: ${context.additionalContext}` : ''}

Please provide your response in the following JSON format:
{
  "suggestions": [
    {
      "type": "restructure|optimize|modernize|document",
      "priority": "high|medium|low",
      "description": "Clear description of the suggested refactoring",
      "line": 1,
      "estimatedImpact": {
        "complexityReduction": 0,
        "maintainabilityImprovement": 0,
        "performanceImprovement": 0
      }
    }
  ],
  "explanation": "Brief explanation of the analysis approach"
}

Focus on practical, actionable suggestions that will have the most impact on code quality.`;
  }

  private buildAnalysisPrompt(code: string, context: AIContext): string {
    return `You are an expert code analyst. Analyze the following ${context.language} code and provide insights about its quality, potential issues, and improvement opportunities.

Code:
\`\`\`${context.language}
${code}
\`\`\`

Please provide your analysis in the following format:
{
  "complexity": "estimated cyclomatic complexity",
  "maintainability": "estimated maintainability score 0-100",
  "issues": [
    {
      "type": "error|warning|info",
      "severity": "high|medium|low",
      "message": "description of the issue",
      "line": 1,
      "rule": "identifier for the rule"
    }
  ],
  "insights": "general observations about the code quality"
}`;
  }

  private parseAnalysisResponse(content: string): Partial<AnalysisResult> {
    try {
      const parsed = JSON.parse(content);
      return {
        // Convert AI response to AnalysisResult format
        // This is a simplified version - in production, you'd want more robust parsing
        issues: parsed.issues?.map((issue: any) => ({
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
          line: issue.line,
          rule: issue.rule
        })) || [],
        suggestions: parsed.suggestions?.map((suggestion: any) => ({
          type: suggestion.type,
          priority: suggestion.priority,
          description: suggestion.description,
          line: suggestion.line,
          estimatedImpact: suggestion.estimatedImpact
        })) || []
      };
    } catch (error) {
      console.error('Error parsing AI analysis response:', error);
      return {};
    }
  }

  async getDefaultModel(): Promise<string> {
    const availableModels = await this.getAvailableModels();
    return availableModels[0] || this.defaultModel;
  }

  async isModelAvailable(modelName: string): Promise<boolean> {
    const model = this.models.get(modelName);
    if (!model) {
      return false;
    }
    
    try {
      return await model.isAvailable();
    } catch (error) {
      return false;
    }
  }
}