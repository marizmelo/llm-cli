/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import * as dotenv from 'dotenv';
import { ModelDiscovery } from './modelDiscovery.js';
import type { LoadedSettings } from './settings.js';
import type { ProviderConfig as SettingsProviderConfig } from './settingsSchema.js';
import { SettingScope } from './settings.js';

export interface ProviderConfig {
  name: string;
  description: string;
  authType: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  defaultModel: string;
  apiKeyFormat: string;
  apiKeyUrl: string;
  models: string[];
}

export interface ProvidersConfig {
  providers: Record<string, ProviderConfig>;
}

export interface ProviderSetupStatus {
  configured: boolean;
  hasApiKey: boolean;
  envVars: Record<string, string>;
  missingVars: string[];
}

export class ProviderManager {
  private providersConfig: ProvidersConfig;
  private envFilePath: string | null;
  private settings: LoadedSettings | null = null;

  constructor(settings?: LoadedSettings) {
    this.providersConfig = this.loadProvidersConfig();
    this.envFilePath = this.findEnvFile();
    this.settings = settings || null;
  }

  private loadProvidersConfig(): ProvidersConfig {
    const configPath = path.join(process.cwd(), '.gemini', 'providers.json');
    try {
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch (error) {
      console.error('Error loading providers config:', error);
    }
    
    // Fallback to default config
    return {
      providers: {
        openai: {
          name: 'OpenAI',
          description: 'GPT-4, GPT-3.5-turbo, and other models',
          authType: 'openai-api-key',
          requiredEnvVars: ['OPENAI_API_KEY'],
          optionalEnvVars: ['OPENAI_MODEL', 'OPENAI_BASE_URL'],
          defaultModel: 'gpt-4',
          apiKeyFormat: 'sk-*',
          apiKeyUrl: 'https://platform.openai.com/api-keys',
          models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k']
        },
        anthropic: {
          name: 'Anthropic',
          description: 'Claude models',
          authType: 'anthropic-api-key',
          requiredEnvVars: ['ANTHROPIC_API_KEY'],
          optionalEnvVars: ['ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL'],
          defaultModel: 'claude-3-opus-20240229',
          apiKeyFormat: 'sk-ant-*',
          apiKeyUrl: 'https://console.anthropic.com/',
          models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
        },
        google: {
          name: 'Google (Gemini)',
          description: 'Google\'s latest AI models',
          authType: 'gemini-api-key',
          requiredEnvVars: ['GEMINI_API_KEY'],
          optionalEnvVars: ['GEMINI_MODEL'],
          defaultModel: 'gemini-1.5-pro-latest',
          apiKeyFormat: 'alphanumeric',
          apiKeyUrl: 'https://aistudio.google.com/',
          models: ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-2.0-flash-exp']
        },
        ollama: {
          name: 'Ollama (Local)',
          description: 'Local models via Ollama',
          authType: 'ollama-local',
          requiredEnvVars: ['OLLAMA_MODEL'],
          optionalEnvVars: ['OLLAMA_BASE_URL'],
          defaultModel: 'llama3.2:latest',
          apiKeyFormat: 'none',
          apiKeyUrl: 'https://ollama.ai/',
          models: ['llama3.2:latest', 'llama3', 'mistral', 'codellama', 'phi3', 'gemma2:latest']
        }
      }
    };
  }

  private findEnvFile(): string | null {
    const searchPaths = [
      path.join(process.cwd(), '.gemini', '.env'),
      path.join(process.cwd(), '.env'),
      path.join(homedir(), '.gemini', '.env'),
      path.join(homedir(), '.env')
    ];

    for (const envPath of searchPaths) {
      if (fs.existsSync(envPath)) {
        return envPath;
      }
    }
    return null;
  }

  private loadEnvFile(): Record<string, string> {
    if (!this.envFilePath) {
      return {};
    }

    try {
      const envContent = fs.readFileSync(this.envFilePath, 'utf-8');
      return dotenv.parse(envContent);
    } catch (error) {
      console.error('Error loading .env file:', error);
      return {};
    }
  }

  private saveEnvFile(envVars: Record<string, string>): void {
    if (!this.envFilePath) {
      // Create .gemini/.env in current directory
      const geminiDir = path.join(process.cwd(), '.gemini');
      if (!fs.existsSync(geminiDir)) {
        fs.mkdirSync(geminiDir, { recursive: true });
      }
      this.envFilePath = path.join(geminiDir, '.env');
    }

    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}="${value}"`)
      .join('\n');

    fs.writeFileSync(this.envFilePath, envContent);
  }

  private validateApiKey(provider: string, apiKey: string): boolean {
    const config = this.providersConfig.providers[provider];
    if (!config) return false;

    switch (config.apiKeyFormat) {
      case 'sk-*':
        return apiKey.startsWith('sk-');
      case 'sk-ant-*':
        return apiKey.startsWith('sk-ant-');
      case 'alphanumeric':
        return /^[A-Za-z0-9_-]+$/.test(apiKey);
      case 'none':
        return true;
      default:
        return true;
    }
  }

  getAvailableProviders(): string[] {
    return Object.keys(this.providersConfig.providers);
  }

  getProviderConfig(provider: string): ProviderConfig | null {
    return this.providersConfig.providers[provider] || null;
  }

  checkProviderSetup(provider: string): ProviderSetupStatus {
    const config = this.getProviderConfig(provider);
    if (!config) {
      return { configured: false, hasApiKey: false, envVars: {}, missingVars: [] };
    }

    const envVars = this.loadEnvFile();
    const missingVars: string[] = [];

    for (const requiredVar of config.requiredEnvVars) {
      if (!envVars[requiredVar]) {
        missingVars.push(requiredVar);
      }
    }

    const hasApiKey = config.requiredEnvVars.every(varName => {
      const value = envVars[varName];
      return value && this.validateApiKey(provider, value);
    });

    return {
      configured: missingVars.length === 0,
      hasApiKey,
      envVars,
      missingVars
    };
  }

  getEnvFilePath(): string | null {
    return this.envFilePath;
  }

  updateEnvVar(key: string, value: string): void {
    const envVars = this.loadEnvFile();
    envVars[key] = value;
    this.saveEnvFile(envVars);
  }

  getCurrentProviderFromAuthType(authType: string): string | null {
    for (const [key, config] of Object.entries(this.providersConfig.providers)) {
      if (config.authType === authType) {
        return key;
      }
    }
    return null;
  }

  /**
   * Get provider configuration from settings
   */
  getProviderFromSettings(providerName: string): SettingsProviderConfig | null {
    if (!this.settings?.merged.providers) {
      return null;
    }
    
    return this.settings.merged.providers.find(
      provider => provider.name === providerName
    ) || null;
  }

  /**
   * Save provider configuration to settings
   */
  saveProviderToSettings(providerName: string, apiKey: string, model?: string): void {
    if (!this.settings) {
      throw new Error('Settings not available');
    }

    const config = this.getProviderConfig(providerName);
    if (!config) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    const existingProviders = this.settings.merged.providers || [];
    const existingIndex = existingProviders.findIndex(p => p.name === config.authType);
    
    const providerConfig: SettingsProviderConfig = {
      name: config.authType,
      apiKey,
      model: model || config.defaultModel
    };

    if (existingIndex >= 0) {
      existingProviders[existingIndex] = providerConfig;
    } else {
      existingProviders.push(providerConfig);
    }

    this.settings.setValue(SettingScope.User, 'providers', existingProviders);
  }

  /**
   * Check if settings have changed
   */
  hasSettingsChanged(newSettings: LoadedSettings | null): boolean {
    return this.settings !== newSettings;
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: LoadedSettings | null): void {
    this.settings = newSettings;
  }

  /**
   * Validate API key format
   */
  validateApiKeyFormat(providerName: string, apiKey: string): boolean {
    const config = this.getProviderConfig(providerName);
    if (!config) return false;

    switch (config.apiKeyFormat) {
      case 'sk-*':
        return apiKey.startsWith('sk-');
      case 'sk-ant-*':
        return apiKey.startsWith('sk-ant-');
      case 'alphanumeric':
        return /^[A-Za-z0-9_-]+$/.test(apiKey);
      case 'none':
        return true;
      default:
        return true;
    }
  }

  /**
   * Sync API keys from settings to environment variables
   * This ensures that the existing authentication flow continues to work
   */
  syncSettingsToEnv(): void {
    if (!this.settings?.merged.providers) {
      return;
    }

    // Map provider auth types from settings to environment variable names
    const providerEnvMap: Record<string, string> = {
      'USE_OPENAI': 'OPENAI_API_KEY',
      'USE_ANTHROPIC': 'ANTHROPIC_API_KEY',
      'USE_GEMINI': 'GEMINI_API_KEY',
      'USE_VERTEX_AI': 'GOOGLE_API_KEY',
      'openai-api-key': 'OPENAI_API_KEY',  // Support both formats
      'anthropic-api-key': 'ANTHROPIC_API_KEY',
      'gemini-api-key': 'GEMINI_API_KEY',
      'google-vertex-ai': 'GOOGLE_API_KEY',
    };

    // Sync each provider's API key to its environment variable
    for (const provider of this.settings.merged.providers) {
      const envVar = providerEnvMap[provider.name];
      if (envVar && provider.apiKey) {
        process.env[envVar] = provider.apiKey;
        
        // Also sync model if provided
        if (provider.model) {
          if (provider.name === 'USE_OPENAI') {
            process.env['OPENAI_MODEL'] = provider.model;
          } else if (provider.name === 'USE_ANTHROPIC') {
            process.env['ANTHROPIC_MODEL'] = provider.model;
          }
        }
      }
    }
  }

  async setupProvider(provider: string, _context: unknown): Promise<{ type: 'message'; messageType: 'info' | 'error'; content: string }> {
    const config = this.getProviderConfig(provider);
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Unknown provider: ${provider}`
      };
    }

    const setup = this.checkProviderSetup(provider);
    
    if (setup.configured && setup.hasApiKey) {
      // Provider is already configured, offer to update
      let message = `✅ ${config.name} is already configured!\n\nCurrent settings:\n`;
      
      for (const varName of [...config.requiredEnvVars, ...config.optionalEnvVars]) {
        const value = setup.envVars[varName];
        if (value) {
          const displayValue = varName.includes('KEY') ? '***' + value.slice(-4) : value;
          message += `  ${varName}: ${displayValue}\n`;
        }
      }
      
      message += `\nUse "/provider switch ${provider}" to activate this provider.`;
      
      return {
        type: 'message',
        messageType: 'info',
        content: message
      };
    }

    // Provider needs setup
    let message = `🔧 Setting up ${config.name}...\n\n`;
    message += `📋 Requirements:\n`;
    message += `  • API Key: ${config.apiKeyFormat === 'none' ? 'Not required' : `Format: ${config.apiKeyFormat}`}\n`;
    message += `  • Get API key from: ${config.apiKeyUrl}\n\n`;

    if (setup.missingVars.length > 0) {
      message += `❌ Missing required environment variables:\n`;
      message += setup.missingVars.map(varName => `  • ${varName}`).join('\n');
      message += `\n\n💡 To complete setup:\n`;
      message += `  1. Get your API key from ${config.apiKeyUrl}\n`;
      message += `  2. Add to your .env file:\n`;
      message += `     ${config.requiredEnvVars.map(varName => `${varName}="your-api-key"`).join('\n     ')}\n`;
      message += `  3. Run "/provider switch ${provider}"\n\n`;
      message += `📝 Or use the interactive setup: /provider setup ${provider}`;
    }

    return {
      type: 'message',
      messageType: 'info',
      content: message
    };
  }

  /**
   * Discovers and updates models for a provider
   */
  async discoverModels(provider: string): Promise<{ success: boolean; message: string }> {
    try {
      const setup = this.checkProviderSetup(provider);
      if (!setup.configured) {
        return {
          success: false,
          message: `Provider ${provider} is not configured. Please set up API keys first.`
        };
      }

      const success = await ModelDiscovery.updateProviderConfig(provider);
      if (success) {
        // Reload the configuration to get updated models
        this.providersConfig = this.loadProvidersConfig();
        return {
          success: true,
          message: `✅ Successfully updated models for ${provider}`
        };
      } else {
        return {
          success: false,
          message: `Failed to update models for ${provider}. Check your API key and try again.`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error discovering models for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Gets model update status for all providers
   */
  getModelUpdateStatus(): Record<string, { needsUpdate: boolean; lastUpdated?: number }> {
    return ModelDiscovery.getUpdateStatus();
  }

  /**
   * Checks if a provider's models need updating
   */
  shouldUpdateModels(provider: string): boolean {
    return ModelDiscovery.shouldUpdateModels(provider);
  }
}
