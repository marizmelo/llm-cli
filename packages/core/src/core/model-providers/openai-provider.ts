/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider, ModelProviderConfig } from './index.js';

interface OpenAICompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIEmbeddingRequest {
  model: string;
  input: string;
}

interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI provider implementation.
 */
export class OpenAIProvider implements ModelProvider {
  name = 'openai';
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: ModelProviderConfig, gcConfig?: any) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model;
  }

  async generateContent(request: any, userPromptId: string) {
    const messages = this.convertToOpenAIMessages(request);
    
    const openaiRequest: OpenAICompletionRequest = {
      model: this.model,
      messages,
      temperature: request.generationConfig?.temperature || 0,
      top_p: request.generationConfig?.topP || 1,
      max_tokens: request.generationConfig?.maxOutputTokens,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const openaiResponse: OpenAICompletionResponse = await response.json();
    
    return this.convertFromOpenAIResponse(openaiResponse);
  }

  async generateContentStream(request: any, userPromptId: string) {
    const messages = this.convertToOpenAIMessages(request);
    
    const openaiRequest: OpenAICompletionRequest = {
      model: this.model,
      messages,
      temperature: request.generationConfig?.temperature || 0,
      top_p: request.generationConfig?.topP || 1,
      max_tokens: request.generationConfig?.maxOutputTokens,
      stream: true,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    return this.createStreamGenerator(reader);
  }

  async countTokens(request: any) {
    // OpenAI doesn't have a separate token counting endpoint for chat completions
    // We'll estimate based on the input text
    const text = this.convertToOpenAIMessages(request)
      .map(msg => msg.content)
      .join('');
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
    
    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: any) {
    const text = this.convertToOpenAIMessages(request)
      .map(msg => msg.content)
      .join('');
    
    const openaiRequest: OpenAIEmbeddingRequest = {
      model: 'text-embedding-ada-002', // Default embedding model
      input: text,
    };

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings API error: ${response.status} ${response.statusText}`);
    }

    const openaiResponse: OpenAIEmbeddingResponse = await response.json();
    
    return {
      embeddings: [
        {
          values: openaiResponse.data[0]?.embedding || [],
        },
      ],
    };
  }

  get userTier() {
    return undefined; // OpenAI doesn't have user tiers in this context
  }

  validateConfig(config: ModelProviderConfig): boolean {
    return config.provider === 'openai' && !!config.apiKey && !!config.model;
  }

  private convertToOpenAIMessages(request: any): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    if (request.contents && Array.isArray(request.contents)) {
      for (const content of request.contents) {
        if (content.parts && Array.isArray(content.parts)) {
          const textContent = content.parts
            .map((part: any) => {
              if (part.text) return part.text;
              if (part.inlineData?.data) {
                // For now, skip non-text content
                return '';
              }
              return '';
            })
            .join('');
          
          if (textContent.trim()) {
            // Determine role based on content structure
            const role = content.role || 'user';
            messages.push({
              role: (role === 'user' ? 'user' : 'assistant') as 'system' | 'user' | 'assistant',
              content: textContent,
            });
          }
        }
      }
    }
    
    return messages;
  }

  private convertFromOpenAIResponse(openaiResponse: OpenAICompletionResponse): any {
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: openaiResponse.choices[0]?.message?.content || '',
              },
            ],
          },
          finishReason: openaiResponse.choices[0]?.finish_reason || 'STOP',
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
            const openaiResponse = JSON.parse(data);
            if (openaiResponse.choices && openaiResponse.choices.length > 0) {
              yield this.convertFromOpenAIResponse(openaiResponse);
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
