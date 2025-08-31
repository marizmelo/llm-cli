/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  deprecated?: boolean;
  created?: number;
}

export interface ModelDiscoveryResult {
  success: boolean;
  models: string[];
  error?: string;
  lastUpdated: number;
}

export class ModelDiscovery {
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CACHE_FILE = path.join(process.cwd(), '.gemini', 'model-cache.json');

  /**
   * Discovers available models for a provider by calling their API
   */
  static async discoverModels(provider: string, apiKey?: string): Promise<ModelDiscoveryResult> {
    try {
      // Check cache first
      const cached = this.getCachedModels(provider);
      if (cached && Date.now() - cached.lastUpdated < this.CACHE_DURATION) {
        return cached;
      }

      // Fetch fresh models based on provider
      let models: string[] = [];
      
      switch (provider) {
        case 'openai':
          models = await this.discoverOpenAIModels(apiKey);
          break;
        case 'anthropic':
          models = await this.discoverAnthropicModels(apiKey);
          break;
        case 'google':
          models = await this.discoverGoogleModels(apiKey);
          break;
        case 'ollama':
          models = await this.discoverOllamaModels();
          break;
        default:
          return {
            success: false,
            models: [],
            error: `Unknown provider: ${provider}`,
            lastUpdated: Date.now()
          };
      }

      const result: ModelDiscoveryResult = {
        success: true,
        models,
        lastUpdated: Date.now()
      };

      // Cache the result
      this.cacheModels(provider, result);

      return result;
    } catch (error) {
      return {
        success: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * Discovers OpenAI models via their API
   */
  private static async discoverOpenAIModels(apiKey?: string): Promise<string[]> {
    const key = apiKey || process.env['OPENAI_API_KEY'];
    if (!key) {
      throw new Error('OpenAI API key not found');
    }

    const baseUrl = process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const models = data.data
      .filter((model: { id: string }) => 
        model.id.startsWith('gpt-') || 
        model.id.startsWith('text-') ||
        model.id.includes('embedding')
      )
      .map((model: { id: string }) => model.id)
      .sort();

    return models;
  }

  /**
   * Discovers Anthropic models via their API
   */
  private static async discoverAnthropicModels(apiKey?: string): Promise<string[]> {
    const key = apiKey || process.env['ANTHROPIC_API_KEY'];
    if (!key) {
      throw new Error('Anthropic API key not found');
    }

    const baseUrl = process.env['ANTHROPIC_BASE_URL'] || 'https://api.anthropic.com';
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const models = data.data
      .filter((model: { id: string }) => model.id.startsWith('claude-'))
      .map((model: { id: string }) => model.id)
      .sort();

    return models;
  }

  /**
   * Discovers Google models via their API
   */
  private static async discoverGoogleModels(apiKey?: string): Promise<string[]> {
    const key = apiKey || process.env['GEMINI_API_KEY'];
    if (!key) {
      throw new Error('Google API key not found');
    }

    // Google's model list is relatively stable, so we can use a curated list
    // with periodic updates from their documentation
    const models = [
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash',
      'gemini-pro',
      'gemini-pro-vision',
      'embedding-001',
      'text-embedding-004'
    ];

    return models.sort();
  }

  /**
   * Discovers Ollama models via local API
   */
  private static async discoverOllamaModels(): Promise<string[]> {
    const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
    
    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models
        .map((model: { name: string }) => model.name)
        .sort();

      return models;
    } catch (_error) {
      // If Ollama is not running, return common models
      return [
        'llama2',
        'llama3',
        'mistral',
        'codellama',
        'phi3',
        'gemma2',
        'qwen2',
        'yi',
        'deepseek'
      ];
    }
  }

  /**
   * Gets cached models for a provider
   */
  private static getCachedModels(provider: string): ModelDiscoveryResult | null {
    try {
      if (!fs.existsSync(this.CACHE_FILE)) {
        return null;
      }

      const cache = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf-8'));
      return cache[provider] || null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Caches models for a provider
   */
  private static cacheModels(provider: string, result: ModelDiscoveryResult): void {
    try {
      const cacheDir = path.dirname(this.CACHE_FILE);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      let cache: Record<string, ModelDiscoveryResult> = {};
      if (fs.existsSync(this.CACHE_FILE)) {
        cache = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf-8'));
      }

      cache[provider] = result;
      fs.writeFileSync(this.CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (_error) {
      console.error('Failed to cache models:', _error);
    }
  }

  /**
   * Updates provider configuration with discovered models
   */
  static async updateProviderConfig(provider: string, apiKey?: string): Promise<boolean> {
    try {
      const discovery = await this.discoverModels(provider, apiKey);
      if (!discovery.success) {
        console.error(`Failed to discover models for ${provider}:`, discovery.error);
        return false;
      }

      // Load current provider config
      const configPath = path.join(process.cwd(), '.gemini', 'providers.json');
      if (!fs.existsSync(configPath)) {
        console.error('Provider configuration file not found');
        return false;
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.providers[provider]) {
        console.error(`Provider ${provider} not found in configuration`);
        return false;
      }

      // Update models list
      const oldModels = config.providers[provider].models || [];
      const newModels = discovery.models;
      
      // Check for new models
      const addedModels = newModels.filter((model: string) => !oldModels.includes(model));
      const removedModels = oldModels.filter((model: string) => !newModels.includes(model));

      if (addedModels.length > 0 || removedModels.length > 0) {
        config.providers[provider].models = newModels;
        config.providers[provider].lastUpdated = Date.now();
        
        // Backup old config
        const backupPath = `${configPath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
        
        // Write updated config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log(`✅ Updated ${provider} models:`);
        if (addedModels.length > 0) {
          console.log(`  Added: ${addedModels.join(', ')}`);
        }
        if (removedModels.length > 0) {
          console.log(`  Removed: ${removedModels.join(', ')}`);
        }
        
        return true;
      } else {
        console.log(`✅ ${provider} models are up to date`);
        return true;
      }
    } catch (error) {
      console.error(`Failed to update provider config for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Checks if models need updating (cache expired)
   */
  static shouldUpdateModels(provider: string): boolean {
    const cached = this.getCachedModels(provider);
    if (!cached) {
      return true;
    }
    
    return Date.now() - cached.lastUpdated > this.CACHE_DURATION;
  }

  /**
   * Gets model update status for all providers
   */
  static getUpdateStatus(): Record<string, { needsUpdate: boolean; lastUpdated?: number }> {
    const status: Record<string, { needsUpdate: boolean; lastUpdated?: number }> = {};
    
    const providers = ['openai', 'anthropic', 'google', 'ollama'];
    
    for (const provider of providers) {
      const cached = this.getCachedModels(provider);
      status[provider] = {
        needsUpdate: !cached || Date.now() - cached.lastUpdated > this.CACHE_DURATION,
        lastUpdated: cached?.lastUpdated
      };
    }
    
    return status;
  }
}
