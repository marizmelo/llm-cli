/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider, ModelProviderConfig } from './index.js';
import type { GenerateContentResponse } from './types.js';

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
  name?: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: any;
    };
  }>;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
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
 * Uses the /api/chat endpoint with tool/function calling support.
 */
export class OllamaProvider implements ModelProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(config: ModelProviderConfig, gcConfig?: any) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model;
  }

  async generateContent(request: any, userPromptId: string) {
    const messages = this.convertToOllamaMessages(request);
    const tools = this.convertToOllamaTools(request);

    const ollamaRequest: OllamaChatRequest = {
      model: this.model,
      messages,
      stream: false,
      ...(tools.length > 0 ? { tools } : {}),
      options: this.buildOptions(request),
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaRequest),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${body}`);
    }

    const ollamaResponse: OllamaChatResponse = await response.json();

    return this.convertFromOllamaChatResponse(ollamaResponse);
  }

  async generateContentStream(request: any, userPromptId: string) {
    const messages = this.convertToOllamaMessages(request);
    const tools = this.convertToOllamaTools(request);

    const ollamaRequest: OllamaChatRequest = {
      model: this.model,
      messages,
      stream: true,
      ...(tools.length > 0 ? { tools } : {}),
      options: this.buildOptions(request),
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaRequest),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${body}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    return this.createStreamGenerator(reader);
  }

  async countTokens(request: any) {
    // Ollama doesn't have a built-in token counting API
    // Estimate based on character count (rough approximation)
    const messages = this.convertToOllamaMessages(request);
    const text = messages.map(msg => msg.content).join('');
    const estimatedTokens = Math.ceil(text.length / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: any) {
    const messages = this.convertToOllamaMessages(request);
    const text = messages.map(msg => msg.content).join('');

    const ollamaRequest: OllamaEmbedRequest = {
      model: this.model,
      prompt: text,
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

  private buildOptions(request: any): OllamaChatRequest['options'] {
    const options: OllamaChatRequest['options'] = {};
    const temp = request.generationConfig?.temperature ?? request.config?.temperature;
    if (temp !== undefined) options!.temperature = temp;
    const topP = request.generationConfig?.topP ?? request.config?.topP;
    if (topP !== undefined) options!.top_p = topP;
    const maxTokens = request.generationConfig?.maxOutputTokens ?? request.config?.maxOutputTokens;
    if (maxTokens !== undefined) options!.num_predict = maxTokens;
    return options;
  }

  private convertToOllamaMessages(request: any): OllamaChatMessage[] {
    const messages: OllamaChatMessage[] = [];

    // Add system instruction if present
    if (request.systemInstruction) {
      const systemText = request.systemInstruction.parts
        ?.map((part: any) => part.text || '')
        .join('') || '';
      if (systemText.trim()) {
        messages.push({ role: 'system', content: systemText });
      }
    }

    if (request.contents && Array.isArray(request.contents)) {
      for (const content of request.contents) {
        if (!content.parts || !Array.isArray(content.parts)) continue;

        const role = content.role || 'user';

        // Check if this content has functionCall parts (model requesting tool use)
        const functionCallParts = content.parts.filter((p: any) => p.functionCall);
        // Check if this content has functionResponse parts (tool results)
        const functionResponseParts = content.parts.filter((p: any) => p.functionResponse);
        // Get text parts
        const textParts = content.parts.filter((p: any) => p.text !== undefined);

        if (functionCallParts.length > 0) {
          // Model message with tool calls
          const textContent = textParts.map((p: any) => p.text).join('');
          const toolCalls = functionCallParts.map((p: any) => ({
            function: {
              name: p.functionCall.name,
              arguments: p.functionCall.args || {},
            },
          }));

          messages.push({
            role: 'assistant',
            content: textContent,
            tool_calls: toolCalls,
          });
        } else if (functionResponseParts.length > 0) {
          // Tool response messages - each functionResponse becomes a separate tool message
          for (const part of functionResponseParts) {
            const output = part.functionResponse.response?.output
              ?? JSON.stringify(part.functionResponse.response ?? {});
            messages.push({
              role: 'tool',
              content: typeof output === 'string' ? output : JSON.stringify(output),
              name: part.functionResponse.name,
            });
          }
        } else {
          // Regular text message
          const textContent = textParts.map((p: any) => p.text).join('');
          if (textContent.trim()) {
            messages.push({
              role: role === 'model' ? 'assistant' : 'user',
              content: textContent,
            });
          }
        }
      }
    }

    return messages;
  }

  private convertToOllamaTools(request: any): Array<{ type: 'function'; function: any }> {
    const tools: Array<{ type: 'function'; function: any }> = [];

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

  private convertFromOllamaChatResponse(ollamaResponse: OllamaChatResponse): GenerateContentResponse {
    const message = ollamaResponse.message;
    const text = message?.content || '';
    const parts: any[] = [];

    // Add text content if present
    if (text) {
      parts.push({ text });
    }

    // Handle tool calls
    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function) {
          // Ollama returns arguments as a parsed object already (not a JSON string)
          const args = typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments || {};

          parts.push({
            functionCall: {
              name: toolCall.function.name,
              args,
            },
          });
        }
      }
    }

    return {
      candidates: [
        {
          content: {
            parts,
          },
          finishReason: ollamaResponse.done ? 'STOP' : 'STOP',
        },
      ],
      text,
      functionCalls: parts.filter(p => p.functionCall).map(p => p.functionCall),
    } as GenerateContentResponse;
  }

  private async *createStreamGenerator(reader: ReadableStreamDefaultReader<Uint8Array>) {
    const decoder = new TextDecoder();
    let buffer = '';

    // Accumulate tool calls across streamed chunks
    let accumulatedToolCalls: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }> = [];
    let accumulatedText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Ollama streams NDJSON - one JSON object per line
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            const chunk: OllamaChatResponse = JSON.parse(trimmedLine);

            // Accumulate text content
            if (chunk.message?.content) {
              accumulatedText += chunk.message.content;
              yield {
                candidates: [
                  {
                    content: {
                      parts: [{ text: chunk.message.content }],
                    },
                    finishReason: undefined,
                  },
                ],
                text: chunk.message.content,
              } as GenerateContentResponse;
            }

            // Accumulate tool calls from chunks
            if (chunk.message?.tool_calls) {
              for (const toolCall of chunk.message.tool_calls) {
                if (toolCall.function) {
                  const args = typeof toolCall.function.arguments === 'string'
                    ? JSON.parse(toolCall.function.arguments)
                    : toolCall.function.arguments || {};
                  accumulatedToolCalls.push({
                    function: { name: toolCall.function.name, arguments: args },
                  });
                }
              }
            }

            // When streaming is done, yield final response with tool calls if any
            if (chunk.done && accumulatedToolCalls.length > 0) {
              const parts: any[] = [];
              for (const tc of accumulatedToolCalls) {
                parts.push({
                  functionCall: {
                    name: tc.function.name,
                    args: tc.function.arguments,
                  },
                });
              }

              yield {
                candidates: [
                  {
                    content: { parts },
                    finishReason: 'STOP',
                  },
                ],
                text: '',
                functionCalls: parts.map(p => p.functionCall),
              } as GenerateContentResponse;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        try {
          const chunk: OllamaChatResponse = JSON.parse(buffer.trim());
          if (chunk.message?.content) {
            yield {
              candidates: [
                {
                  content: {
                    parts: [{ text: chunk.message.content }],
                  },
                  finishReason: chunk.done ? 'STOP' : undefined,
                },
              ],
              text: chunk.message.content,
            } as GenerateContentResponse;
          }

          if (chunk.done && accumulatedToolCalls.length > 0) {
            const parts: any[] = [];
            for (const tc of accumulatedToolCalls) {
              parts.push({
                functionCall: {
                  name: tc.function.name,
                  args: tc.function.arguments,
                },
              });
            }

            yield {
              candidates: [
                {
                  content: { parts },
                  finishReason: 'STOP',
                },
              ],
              text: '',
              functionCalls: parts.map(p => p.functionCall),
            } as GenerateContentResponse;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
