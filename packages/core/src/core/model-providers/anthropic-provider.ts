/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider, ModelProviderConfig } from './index.js';
import type { GenerateContentResponse } from './types.js';

interface AnthropicCompletionRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{
      type: 'text' | 'tool_use' | 'tool_result';
      text?: string;
      id?: string;
      name?: string;
      input?: any;
      tool_use_id?: string;
      content?: any;
    }>;
  }>;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<{
    name: string;
    description?: string;
    input_schema: {
      type: 'object';
      properties?: any;
      required?: string[];
    };
  }>;
  system?: string;
}

interface AnthropicCompletionResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
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
    const tools = this.convertToAnthropicTools(request);
    const system = request.config?.systemInstruction || request.systemInstruction;
    
    const anthropicRequest: AnthropicCompletionRequest = {
      model: this.model,
      messages,
      max_tokens: request.generationConfig?.maxOutputTokens || request.config?.maxOutputTokens || 1000,
      temperature: request.generationConfig?.temperature || request.config?.temperature || 0,
      top_p: request.generationConfig?.topP || request.config?.topP || 1,
      stream: false,
      ...(tools.length > 0 ? { tools } : {}),
      ...(system ? { system } : {}),
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
    const tools = this.convertToAnthropicTools(request);
    const system = request.config?.systemInstruction || request.systemInstruction;
    
    const anthropicRequest: AnthropicCompletionRequest = {
      model: this.model,
      messages,
      max_tokens: request.generationConfig?.maxOutputTokens || request.config?.maxOutputTokens || 1000,
      temperature: request.generationConfig?.temperature || request.config?.temperature || 0,
      top_p: request.generationConfig?.topP || request.config?.topP || 1,
      stream: true,
      ...(tools.length > 0 ? { tools } : {}),
      ...(system ? { system } : {}),
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

  private convertToAnthropicMessages(request: any): Array<{ role: 'user' | 'assistant'; content: any }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
    
    if (request.contents && Array.isArray(request.contents)) {
      for (const content of request.contents) {
        if (content.parts && Array.isArray(content.parts)) {
          const messageParts: any[] = [];
          
          // Process each part
          for (const part of content.parts) {
            if (part.text) {
              messageParts.push({ type: 'text', text: part.text });
            } else if (part.functionResponse) {
              // Handle function/tool responses
              messageParts.push({
                type: 'tool_result',
                tool_use_id: part.functionResponse.id || part.functionResponse.name,
                content: JSON.stringify(part.functionResponse.response || {}),
              });
            }
          }
          
          if (messageParts.length > 0) {
            const role = content.role === 'model' ? 'assistant' : 'user';
            // If there's only one text part, use simple string format
            if (messageParts.length === 1 && messageParts[0].type === 'text') {
              messages.push({ role, content: messageParts[0].text });
            } else if (messageParts.length > 0) {
              // Use array format for complex messages
              messages.push({ role, content: messageParts });
            }
          }
        }
      }
    }
    
    return messages;
  }

  private convertFromAnthropicResponse(anthropicResponse: AnthropicCompletionResponse): GenerateContentResponse {
    const parts: any[] = [];
    let text = '';
    const functionCalls: any[] = [];
    
    // Process all content blocks
    for (const contentBlock of anthropicResponse.content) {
      if (contentBlock.type === 'text' && contentBlock.text) {
        parts.push({ text: contentBlock.text });
        text += contentBlock.text;
      } else if (contentBlock.type === 'tool_use') {
        // Convert Anthropic tool use to function call format
        const functionCall = {
          name: contentBlock.name,
          args: contentBlock.input || {},
        };
        parts.push({ functionCall });
        functionCalls.push(functionCall);
      }
    }
    
    return {
      candidates: [
        {
          content: {
            parts,
          },
          finishReason: anthropicResponse.stop_reason || 'STOP',
        },
      ],
      text,
      ...(functionCalls.length > 0 ? { functionCalls } : {}),
    } as GenerateContentResponse;
  }

  private convertToAnthropicTools(request: any): Array<{ name: string; description?: string; input_schema: any }> {
    const tools: Array<{ name: string; description?: string; input_schema: any }> = [];
    
    // Check for tools in config
    if (request.config?.tools) {
      for (const tool of request.config.tools) {
        if (tool.functionDeclarations) {
          for (const func of tool.functionDeclarations) {
            tools.push({
              name: func.name,
              description: func.description,
              input_schema: {
                type: 'object',
                properties: func.parameters?.properties || {},
                required: func.parameters?.required || [],
              },
            });
          }
        }
      }
    }
    
    return tools;
  }

  private async *createStreamGenerator(reader: ReadableStreamDefaultReader<Uint8Array>) {
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Append to buffer to handle partial chunks
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
          
          const data = trimmedLine.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') break;
          
          try {
            const event = JSON.parse(data);
            
            // Handle different event types
            if (event.type === 'content_block_delta' && event.delta?.text) {
              // Text delta
              yield {
                candidates: [
                  {
                    content: {
                      parts: [{ text: event.delta.text }],
                    },
                    finishReason: undefined,
                  },
                ],
                text: event.delta.text,
              } as GenerateContentResponse;
            } else if (event.type === 'message_stop') {
              // Stream complete
              return;
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
