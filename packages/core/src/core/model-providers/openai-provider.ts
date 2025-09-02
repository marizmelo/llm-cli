/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider, ModelProviderConfig } from './index.js';
import type { GenerateContentResponse } from './types.js';

interface OpenAICompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string; // For function messages
    function_call?: {
      name: string;
      arguments: string;
    };
  }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: any;
    };
  }>;
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
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
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
      function_call?: {
        name: string;
        arguments: string;
      };
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
    const tools = this.convertToOpenAITools(request);
    
    const openaiRequest: OpenAICompletionRequest = {
      model: this.model,
      messages,
      temperature: request.generationConfig?.temperature || request.config?.temperature || 0,
      top_p: request.generationConfig?.topP || request.config?.topP || 1,
      max_tokens: request.generationConfig?.maxOutputTokens || request.config?.maxOutputTokens,
      stream: false,
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
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
    const tools = this.convertToOpenAITools(request);
    
    const openaiRequest: OpenAICompletionRequest = {
      model: this.model,
      messages,
      temperature: request.generationConfig?.temperature || request.config?.temperature || 0,
      top_p: request.generationConfig?.topP || request.config?.topP || 1,
      max_tokens: request.generationConfig?.maxOutputTokens || request.config?.maxOutputTokens,
      stream: true,
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
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

  private convertFromOpenAIResponse(openaiResponse: OpenAICompletionResponse): GenerateContentResponse {
    const choice = openaiResponse.choices[0];
    const text = choice?.message?.content || '';
    const parts: any[] = [];
    
    // Add text content if present
    if (text) {
      parts.push({ text });
    }
    
    // Handle tool calls (OpenAI's function calling)
    if (choice?.message?.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function) {
          parts.push({
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments || '{}'),
            },
          });
        }
      }
    }
    
    // Handle legacy function_call format
    if (choice?.message?.function_call) {
      parts.push({
        functionCall: {
          name: choice.message.function_call.name,
          args: JSON.parse(choice.message.function_call.arguments || '{}'),
        },
      });
    }
    
    return {
      candidates: [
        {
          content: {
            parts,
          },
          finishReason: choice?.finish_reason || 'STOP',
        },
      ],
      text,  // Add required text property
      functionCalls: parts.filter(p => p.functionCall).map(p => p.functionCall),
    } as GenerateContentResponse;
  }

  private convertToOpenAITools(request: any): Array<{ type: 'function'; function: any }> {
    const tools: Array<{ type: 'function'; function: any }> = [];
    
    // Check for tools in config
    if (request.config?.tools) {
      for (const tool of request.config.tools) {
        if (tool.functionDeclarations) {
          for (const func of tool.functionDeclarations) {
            tools.push({
              type: 'function',
              function: {
                name: func.name,
                description: func.description,
                parameters: func.parameters || {},
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
        
        // Append new chunk to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
          
          const data = trimmedLine.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') {
            // Stream is complete
            return;
          }
          
          try {
            const openaiResponse = JSON.parse(data);
            if (openaiResponse.choices && openaiResponse.choices.length > 0) {
              const choice = openaiResponse.choices[0];
              const content = choice?.delta?.content;
              const toolCalls = choice?.delta?.tool_calls;
              
              // Handle text content
              if (content) {
                // For streaming responses, OpenAI sends content in 'delta' field
                yield {
                  candidates: [
                    {
                      content: {
                        parts: [
                          {
                            text: content,
                          },
                        ],
                      },
                      finishReason: choice?.finish_reason || undefined,
                    },
                  ],
                  text: content,  // Add required text property
                } as GenerateContentResponse;
              }
              
              // Handle tool calls in streaming
              if (toolCalls && toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                  if (toolCall.function?.arguments) {
                    // OpenAI streams function arguments incrementally
                    // For now, we'll skip partial function calls in streaming
                    // The full function call will come in the final non-streaming response
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to parse OpenAI stream chunk:', e);
          }
        }
      }
      
      // Process any remaining data in buffer
      if (buffer.trim()) {
        console.warn('Incomplete data in buffer:', buffer);
      }
    } finally {
      reader.releaseLock();
    }
  }
}
