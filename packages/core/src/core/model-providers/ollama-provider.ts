/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider, ModelProviderConfig } from './index.js';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaGenerateResponse {
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

interface OllamaEmbedRequest {
  model: string;
  prompt: string;
}

interface OllamaEmbedResponse {
  embedding: number[];
}

/**
 * Ollama provider implementation for local models.
 */
export class OllamaProvider implements ModelProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(config: ModelProviderConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model;
  }

  async generateContent(request: any, userPromptId: string) {
    const prompt = this.convertToOllamaPrompt(request);
    
    const ollamaRequest: OllamaGenerateRequest = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: request.generationConfig?.temperature || 0,
        top_p: request.generationConfig?.topP || 1,
        num_predict: request.generationConfig?.maxOutputTokens,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaRequest),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const ollamaResponse: OllamaGenerateResponse = await response.json();
    
    return this.convertFromOllamaResponse(ollamaResponse);
  }

  async generateContentStream(request: any, userPromptId: string) {
    const prompt = this.convertToOllamaPrompt(request);
    
    const ollamaRequest: OllamaGenerateRequest = {
      model: this.model,
      prompt,
      stream: true,
      options: {
        temperature: request.generationConfig?.temperature || 0,
        top_p: request.generationConfig?.topP || 1,
        num_predict: request.generationConfig?.maxOutputTokens,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaRequest),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    return this.createStreamGenerator(reader);
  }

  async countTokens(request: any) {
    // Ollama doesn't have a built-in token counting API
    // We'll estimate based on character count (rough approximation)
    const text = this.convertToOllamaPrompt(request);
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
    
    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: any) {
    const prompt = this.convertToOllamaPrompt(request);
    
    const ollamaRequest: OllamaEmbedRequest = {
      model: this.model,
      prompt,
    };

    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaRequest),
    });

    if (!response.ok) {
      throw new Error(`Ollama embeddings API error: ${response.status} ${response.statusText}`);
    }

    const ollamaResponse: OllamaEmbedResponse = await response.json();
    
    return {
      embeddings: [
        {
          values: ollamaResponse.embedding,
        },
      ],
    };
  }

  get userTier() {
    return undefined; // Ollama doesn't have user tiers
  }

  validateConfig(config: ModelProviderConfig): boolean {
    return config.provider === 'ollama' && !!config.model;
  }

  private convertToOllamaPrompt(request: any): string {
    // Convert Gemini format to Ollama format
    if (request.contents && Array.isArray(request.contents)) {
      return request.contents
        .map((content: any) => {
          if (content.parts && Array.isArray(content.parts)) {
            return content.parts
              .map((part: any) => {
                if (part.text) return part.text;
                if (part.inlineData?.data) {
                  // For now, skip non-text content
                  return '';
                }
                return '';
              })
              .join('');
          }
          return '';
        })
        .join('\n');
    }
    return '';
  }

  private convertFromOllamaResponse(ollamaResponse: OllamaGenerateResponse): any {
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: ollamaResponse.response,
              },
            ],
          },
          finishReason: ollamaResponse.done ? 'STOP' : 'MAX_TOKENS',
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
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const ollamaResponse: OllamaGenerateResponse = JSON.parse(line);
            yield this.convertFromOllamaResponse(ollamaResponse);
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
