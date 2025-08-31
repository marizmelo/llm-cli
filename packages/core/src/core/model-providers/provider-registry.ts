/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider, ModelProviderConfig } from './index.js';
import { GoogleProvider } from './google-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import type { Config } from '../../config/config.js';

/**
 * Registry for managing model providers.
 */
export class ModelProviderRegistry {
  private providers = new Map<string, new (config: ModelProviderConfig, gcConfig?: Config) => ModelProvider>();

  constructor() {
    this.register('google', GoogleProvider);
    this.register('openai', OpenAIProvider);
    this.register('anthropic', AnthropicProvider);
    this.register('ollama', OllamaProvider);
  }

  /**
   * Register a new provider class.
   */
  register(name: string, providerClass: new (config: ModelProviderConfig, gcConfig?: Config) => ModelProvider) {
    this.providers.set(name, providerClass);
  }

  /**
   * Create a provider instance.
   */
  createProvider(config: ModelProviderConfig, gcConfig?: Config): ModelProvider {
    const ProviderClass = this.providers.get(config.provider);
    if (!ProviderClass) {
      throw new Error(`Unknown provider: ${config.provider}. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return new ProviderClass(config, gcConfig);
  }

  /**
   * Get list of available providers.
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available.
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }
}
