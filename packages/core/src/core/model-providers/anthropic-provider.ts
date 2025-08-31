/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider, ModelProviderConfig } from './index.js';

interface AnthropicCompletionRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

interface AnthropicCompletionResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic provider implementation.
 */
export class AnthropicProvider implements ModelProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: ModelProviderConfig, gcConfig?: any) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.model = config.model;
  }

  async generateContent(request: any, userPromptId: string) {
    const messages = this.convertToAnthropicMessages(request);
    
    const anthropicRequest: AnthropicCompletionRequest = {
      model: this.model,
      messages,
      max_tokens: request.generationConfig?.maxOutputTokens || 1000,
      temperature: request.generationConfig?.temperature || 0,
      top_p: request.generationConfig?.topP || 1,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicRequest),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const anthropicResponse: AnthropicCompletionResponse = await response.json();
    
    return this.convertFromAnthropicResponse(anthropicResponse);
  }

  async generateContentStream(request: any, userPromptId: string) {
    const messages = this.convertToAnthropicMessages(request);
    
    const anthropicRequest: AnthropicCompletionRequest = {
      model: this.model,
      messages,
      max_tokens: request.generationConfig?.maxOutputTokens || 1000,
      temperature: request.generationConfig?.temperature || 0,
      top_p: request.generationConfig?.topP || 1,
      stream: true,
    };

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicRequest),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    return this.createStreamGenerator(reader);
  }

  async countTokens(request: any) {
    // Anthropic doesn't have a separate token counting endpoint
    // We'll estimate based on the input text
    const text = this.convertToAnthropicMessages(request)
      .map(msg => msg.content)
      .join('');
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
    
    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: any) {
    // Anthropic doesn't provide embeddings API
    // Return empty embeddings to satisfy the interface
    return {
      embeddings: [],
    };
  }

  get userTier() {
    return undefined; // Anthropic doesn't have user tiers in this context
  }

  validateConfig(config: ModelProviderConfig): boolean {
    return config.provider === 'anthropic' && !!config.apiKey && !!config.model;
  }

  private convertToAnthropicMessages(request: any): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    if (request.contents && Array.isArray(request.contents)) {
      for (const content of request.contents) {
        if (content.parts && Array.isArray(content.parts)) {
          const textContent = content.parts
            .map((part: any) => {
              if (part.text) return part.text;
              return '';
            })
            .join('');
          
          if (textContent.trim()) {
            const role = content.role || 'user';
            messages.push({
              role: (role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: textContent,
            });
          }
        }
      }
    }
    
    return messages;
  }

  private convertFromAnthropicResponse(anthropicResponse: AnthropicCompletionResponse): any {
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: anthropicResponse.content[0]?.text || '',
              },
            ],
          },
          finishReason: anthropicResponse.stop_reason || 'STOP',
        },
      ],
    };
  }

  private async *createStreamGenerator(reader: ReadableStreamDefaultReader<Uint8Array>) {
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));
        
        for (const line of lines) {
          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') break;
          
          try {
            const anthropicResponse = JSON.parse(data);
            if (anthropicResponse.content && anthropicResponse.content.length > 0) {
              yield this.convertFromAnthropicResponse(anthropicResponse);
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
