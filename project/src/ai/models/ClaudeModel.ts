import { AIModel, AIResponse, AIContext, AIModelConfig } from '../AIModelManager';
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeModel implements AIModel {
  private client: Anthropic;
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  get name(): string {
    return 'claude';
  }

  async generate(prompt: string, _context?: AIContext): Promise<AIResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model || 'claude-3-sonnet-20240229',
        max_tokens: this.config.maxTokens || 1000,
        temperature: this.config.temperature || 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      const suggestions = this.parseSuggestionsFromResponse(content);

      return {
        content,
        suggestions,
        confidence: this.calculateConfidence(response),
        model: this.name
      };
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        return false;
      }

      // Simple health check - try a minimal request
      await this.client.messages.create({
        model: this.config.model || 'claude-3-sonnet-20240229',
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
      console.warn('Claude model not available:', error);
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
      
      // Fallback: extract suggestions from text
      return this.extractSuggestionsFromText(content);
    } catch (error) {
      console.warn('Error parsing suggestions from Claude response:', error);
      return [];
    }
  }

  private extractSuggestionsFromText(content: string): any[] {
    const suggestions: any[] = [];
    
    // Simple heuristic-based extraction
    const lines = content.split('\n');
    let currentSuggestion: any = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for suggestion patterns
      if (trimmed.match(/^(high|medium|low)\s+priority/i) || 
          trimmed.match(/^(restructure|optimize|modernize|document)/i)) {
        
        if (currentSuggestion) {
          suggestions.push(currentSuggestion);
        }
        
        currentSuggestion = {
          type: this.extractSuggestionType(trimmed),
          priority: this.extractPriority(trimmed),
          description: trimmed,
          line: 1,
          estimatedImpact: {
            complexityReduction: 0,
            maintainabilityImprovement: 0,
            performanceImprovement: 0
          }
        };
      } else if (currentSuggestion && trimmed.length > 0) {
        currentSuggestion.description += ' ' + trimmed;
      }
    }
    
    if (currentSuggestion) {
      suggestions.push(currentSuggestion);
    }
    
    return suggestions;
  }

  private extractSuggestionType(text: string): string {
    if (text.match(/restructure/i)) return 'restructure';
    if (text.match(/optimize/i)) return 'optimize';
    if (text.match(/modernize/i)) return 'modernize';
    if (text.match(/document/i)) return 'document';
    return 'optimize';
  }

  private extractPriority(text: string): string {
    if (text.match(/high/i)) return 'high';
    if (text.match(/medium/i)) return 'medium';
    if (text.match(/low/i)) return 'low';
    return 'medium';
  }

  private calculateConfidence(response: any): number {
    // Calculate confidence based on various factors
    // This is a simplified version - in production, you'd use more sophisticated metrics
    
    let confidence = 0.8; // Base confidence
    
    // Adjust based on response length and structure
    if (response.content && response.content[0] && response.content[0].text) {
      const textLength = response.content[0].text.length;
      if (textLength > 100) confidence += 0.1;
      if (textLength > 500) confidence += 0.05;
    }
    
    // Adjust based on model confidence scores if available
    if (response.usage) {
      // Higher token usage might indicate more thorough analysis
      const tokenRatio = response.usage.output_tokens / (response.usage.input_tokens || 1);
      if (tokenRatio > 0.5) confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0);
  }
}