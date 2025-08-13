import { AIModel, AIResponse, AIContext, AIModelConfig } from '../AIModelManager';
import OpenAI from 'openai';

export class OpenAIModel implements AIModel {
  private client: OpenAI;
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  get name(): string {
    return 'gpt';
  }

  async generate(prompt: string, context?: AIContext): Promise<AIResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4-turbo',
        max_tokens: this.config.maxTokens || 1000,
        temperature: this.config.temperature || 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software engineer specializing in code analysis and refactoring. Provide structured, actionable feedback in JSON format when requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.choices[0]?.message?.content || '';
      const suggestions = this.parseSuggestionsFromResponse(content);

      return {
        content,
        suggestions,
        confidence: this.calculateConfidence(response),
        model: this.name
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        return false;
      }

      // Simple health check
      await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4-turbo',
        max_tokens: 10,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      });

      return true;
    } catch (error) {
      console.warn('OpenAI model not available:', error);
      return false;
    }
  }

  private parseSuggestionsFromResponse(content: string): any[] {
    try {
      // Try to parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.suggestions || [];
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
      console.warn('Error parsing suggestions from OpenAI response:', error);
      return [];
    }
  }

  private extractSuggestionsFromText(content: string): any[] {
    const suggestions: any[] = [];
    
    // Look for numbered lists or bullet points
    const lines = content.split('\n');
    let currentSuggestion: any = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for numbered items or bullet points
      if (trimmed.match(/^(\d+\.|\*|-)\s/) || 
          trimmed.match(/^(high|medium|low)\s+priority/i) || 
          trimmed.match(/^(restructure|optimize|modernize|document)/i)) {
        
        if (currentSuggestion) {
          suggestions.push(currentSuggestion);
        }
        
        // Clean up the line
        const cleanLine = trimmed.replace(/^(\d+\.|\*|-)\s*/, '');
        
        currentSuggestion = {
          type: this.extractSuggestionType(cleanLine),
          priority: this.extractPriority(cleanLine),
          description: cleanLine,
          line: 1,
          estimatedImpact: {
            complexityReduction: 0,
            maintainabilityImprovement: 0,
            performanceImprovement: 0
          }
        };
      } else if (currentSuggestion && trimmed.length > 0 && !trimmed.startsWith('```')) {
        currentSuggestion.description += ' ' + trimmed;
      }
    }
    
    if (currentSuggestion) {
      suggestions.push(currentSuggestion);
    }
    
    return suggestions;
  }

  private extractSuggestionType(text: string): string {
    if (text.match(/restructure|refactor/i)) return 'restructure';
    if (text.match(/optimize|performance/i)) return 'optimize';
    if (text.match(/modernize|update/i)) return 'modernize';
    if (text.match(/document|comment/i)) return 'document';
    return 'optimize';
  }

  private extractPriority(text: string): string {
    if (text.match(/high|critical|urgent/i)) return 'high';
    if (text.match(/medium|moderate/i)) return 'medium';
    if (text.match(/low|minor|optional/i)) return 'low';
    return 'medium';
  }

  private calculateConfidence(response: any): number {
    let confidence = 0.8; // Base confidence
    
    // Adjust based on response quality indicators
    if (response.choices && response.choices[0]) {
      const choice = response.choices[0];
      
      // Check if response is complete
      if (choice.finish_reason === 'stop') {
        confidence += 0.1;
      }
      
      // Check message content
      if (choice.message && choice.message.content) {
        const contentLength = choice.message.content.length;
        if (contentLength > 100) confidence += 0.05;
        if (contentLength > 500) confidence += 0.05;
      }
    }
    
    // Adjust based on usage statistics
    if (response.usage) {
      const tokenRatio = response.usage.completion_tokens / (response.usage.prompt_tokens || 1);
      if (tokenRatio > 0.3) confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0);
  }
}