import { AIModel, AIResponse, AIContext, AIModelConfig } from '../AIModelManager';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class LocalModel implements AIModel {
  private config: AIModelConfig;
  private endpoint: string;

  constructor(config: AIModelConfig) {
    this.config = config;
    this.endpoint = config.baseUrl || 'http://localhost:11434';
  }

  get name(): string {
    return 'local';
  }

  async generate(prompt: string, context?: AIContext): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model || 'codellama',
          prompt: prompt,
          stream: false,
          options: {
            temperature: this.config.temperature || 0.3,
            num_predict: this.config.maxTokens || 1000,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: OllamaResponse = await response.json();
      const suggestions = this.parseSuggestionsFromResponse(data.response);

      return {
        content: data.response,
        suggestions,
        confidence: this.calculateConfidence(data),
        model: this.name
      };
    } catch (error) {
      console.error('Error calling local model API:', error);
      throw new Error(`Local model API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama is running
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return false;
      }

      // Check if the specific model is available
      const tagsResponse = await response.json();
      const models = tagsResponse.models || [];
      const modelExists = models.some((model: any) => model.name === this.config.model);

      return modelExists;
    } catch (error) {
      console.warn('Local model not available:', error);
      return false;
    }
  }

  private parseSuggestionsFromResponse(content: string): any[] {
    try {
      // Try to parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.suggestions || [];
        } catch (e) {
          // Continue to fallback
        }
      }
      
      // Try to parse JSON code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        try {
          const parsed = JSON.parse(codeBlockMatch[1]);
          return parsed.suggestions || [];
        } catch (e) {
          // Continue to fallback
        }
      }
      
      // Fallback: extract suggestions from text
      return this.extractSuggestionsFromText(content);
    } catch (error) {
      console.warn('Error parsing suggestions from local model response:', error);
      return [];
    }
  }

  private extractSuggestionsFromText(content: string): any[] {
    const suggestions: any[] = [];
    
    // Split content into sections
    const sections = content.split(/\n\s*\n/);
    
    for (const section of sections) {
      const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length === 0) continue;
      
      // Look for suggestion indicators
      const firstLine = lines[0];
      if (this.isSuggestionLine(firstLine)) {
        const suggestion = {
          type: this.extractSuggestionType(firstLine),
          priority: this.extractPriority(firstLine),
          description: lines.join(' '),
          line: 1,
          estimatedImpact: {
            complexityReduction: 0,
            maintainabilityImprovement: 0,
            performanceImprovement: 0
          }
        };
        
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }

  private isSuggestionLine(line: string): boolean {
    return line.match(/(suggest|recommend|improve|optimize|refactor|restructure)/i) !== null ||
           line.match(/^(high|medium|low)\s+priority/i) !== null ||
           line.match(/^(\d+\.|\*|-)\s/) !== null;
  }

  private extractSuggestionType(text: string): string {
    if (text.match(/restructure|refactor/i)) return 'restructure';
    if (text.match(/optimize|performance|speed/i)) return 'optimize';
    if (text.match(/modernize|update|new/i)) return 'modernize';
    if (text.match(/document|comment|explain/i)) return 'document';
    return 'optimize';
  }

  private extractPriority(text: string): string {
    if (text.match(/high|critical|urgent|important/i)) return 'high';
    if (text.match(/medium|moderate|normal/i)) return 'medium';
    if (text.match(/low|minor|optional|small/i)) return 'low';
    return 'medium';
  }

  private calculateConfidence(response: OllamaResponse): number {
    let confidence = 0.7; // Base confidence for local models
    
    // Adjust based on response characteristics
    if (response.response && response.response.length > 50) {
      confidence += 0.1;
    }
    
    if (response.response && response.response.length > 200) {
      confidence += 0.05;
    }
    
    // Adjust based on evaluation metrics if available
    if (response.eval_count && response.prompt_eval_count) {
      const evalRatio = response.eval_count / response.prompt_eval_count;
      if (evalRatio > 0.5) confidence += 0.05;
    }
    
    // Adjust based on timing (faster is better for local models)
    if (response.total_duration && response.total_duration < 10000000000) { // 10 seconds
      confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0);
  }

  async pullModel(modelName: string = this.config.model || 'codellama'): Promise<void> {
    try {
      const response = await fetch(`${this.endpoint}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
          stream: false,
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }

      console.log(`Successfully pulled model: ${modelName}`);
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.warn('Error getting available models:', error);
      return [];
    }
  }
}