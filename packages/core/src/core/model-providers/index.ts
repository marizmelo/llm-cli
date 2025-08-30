/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from '../contentGenerator.js';

/**
 * Interface for AI model providers that can generate content, count tokens, and embed content.
 */
export interface ModelProvider extends ContentGenerator {
  name: string;
  validateConfig(config: ModelProviderConfig): boolean;
}

/**
 * Configuration for model providers.
 */
export interface ModelProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  [key: string]: any; // Allow provider-specific config
}

/**
 * Supported model providers.
 */
export enum ModelProviderType {
  GOOGLE = 'google',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  AZURE_OPENAI = 'azure-openai',
  OLLAMA = 'ollama',
}

// Export provider implementations
export { GoogleProvider } from './google-provider.js';
export { OpenAIProvider } from './openai-provider.js';
export { OllamaProvider } from './ollama-provider.js';
export { ModelProviderRegistry } from './provider-registry.js';
