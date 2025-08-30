/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { ModelProviderRegistry } from './provider-registry.js';
import type { ModelProviderConfig } from './index.js';

describe('ModelProviderRegistry', () => {
  it('should register and create providers', () => {
    const registry = new ModelProviderRegistry();
    
    // Test available providers
    expect(registry.getAvailableProviders()).toContain('google');
    expect(registry.getAvailableProviders()).toContain('openai');
    expect(registry.getAvailableProviders()).toContain('ollama');
    
    // Test provider existence
    expect(registry.hasProvider('google')).toBe(true);
    expect(registry.hasProvider('openai')).toBe(true);
    expect(registry.hasProvider('ollama')).toBe(true);
    expect(registry.hasProvider('nonexistent')).toBe(false);
  });

  it('should create provider instances', () => {
    const registry = new ModelProviderRegistry();
    
    const config: ModelProviderConfig = {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4',
    };
    
    const provider = registry.createProvider(config);
    expect(provider.name).toBe('openai');
    expect(provider.validateConfig(config)).toBe(true);
  });

  it('should throw error for unknown provider', () => {
    const registry = new ModelProviderRegistry();
    
    const config: ModelProviderConfig = {
      provider: 'nonexistent',
      model: 'test-model',
    };
    
    expect(() => {
      registry.createProvider(config);
    }).toThrow('Unknown provider: nonexistent');
  });
});
