/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuthType } from '../../../../core/dist/src/core/contentGenerator.js';
import { MessageType } from '../types.js';
import type { SlashCommand, SlashCommandActionReturn, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { validateAuthMethod } from '../../config/auth.js';
import { SettingScope } from '../../config/settings.js';
import { ProviderManager } from '../../config/providerManager.js';

// ProviderManager will be instantiated with settings from context
let providerManager: ProviderManager;

function getProviderManager(context: CommandContext): ProviderManager {
  if (!providerManager || providerManager.hasSettingsChanged(context.services.settings)) {
    providerManager = new ProviderManager(context.services.settings || undefined);
    // Sync settings to environment variables on initialization
    providerManager.syncSettingsToEnv();
  }
  return providerManager;
}

// Enhanced list command
const providerListCommand: SlashCommand = {
  name: 'list',
  description: 'List available AI providers with setup status',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<SlashCommandActionReturn> => {
    const providers = getProviderManager(context).getAvailableProviders();
    const currentAuthType = context.services.config?.getContentGeneratorConfig()?.authType;

    let message = '🤖 Available AI Providers:\n\n';
    
    for (const providerKey of providers) {
      const config = getProviderManager(context).getProviderConfig(providerKey)!;
      const setup = getProviderManager(context).checkProviderSetup(providerKey);
      const isCurrent = currentAuthType === config.authType;
      
      const status = isCurrent ? ' (current)' : '';
      const setupStatus = setup.configured ? '✅ Configured' : '❌ Not configured';
      
      message += `  ${isCurrent ? '→ ' : '  '}${config.name}${status}\n`;
      message += `    ${config.description}\n`;
      message += `    Status: ${setupStatus}\n`;
      
      if (setup.configured) {
        const modelKey = `${providerKey.toUpperCase()}_MODEL`;
        const currentModel = setup.envVars[modelKey] || config.defaultModel;
        message += `    Model: ${currentModel}\n`;
      }
      
      message += '\n';
    }

    message += '📋 Commands:\n';
    message += '  /provider switch <provider>  - Switch to a provider\n';
    message += '  /provider setup <provider>  - Interactive setup\n';
    message += '  /provider status           - Show current status\n';
    message += '  /provider model [model]    - List or switch models\n';
    message += '  /provider discover <provider> - Discover new models\n';
    message += '  /provider update           - Update all providers\n';

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };
  },
};

// Enhanced switch command
const providerSwitchCommand: SlashCommand = {
  name: 'switch',
  description: 'Switch to a different AI provider',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn> => {
    const providerName = args.trim().toLowerCase();
    
    if (!providerName) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /provider switch <provider-name>\nAvailable providers: ' + getProviderManager(context).getAvailableProviders().join(', '),
      };
    }

    const config = getProviderManager(context).getProviderConfig(providerName);
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Unknown provider: ${providerName}\nAvailable providers: ${getProviderManager(context).getAvailableProviders().join(', ')}`,
      };
    }

    // Sync settings to environment before checking setup
    getProviderManager(context).syncSettingsToEnv();
    
    // Check if provider is properly configured
    const setup = getProviderManager(context).checkProviderSetup(providerName);
    if (!setup.configured) {
      return await getProviderManager(context).setupProvider(providerName, context);
    }

    // Validate the auth method
    const validationError = validateAuthMethod(config.authType as AuthType);
    if (validationError) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Cannot switch to ${providerName}: ${validationError}`,
      };
    }

    const cliConfig = context.services.config;
    if (!cliConfig) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    try {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Switching to ${config.name} provider...`,
        },
        Date.now(),
      );

      // Switch the provider
      await cliConfig.refreshAuth(config.authType as AuthType);

      // Update settings to remember the choice
      const settings = context.services.settings;
      if (settings) {
        settings.setValue(SettingScope.User, 'security.auth.selectedType', config.authType as AuthType);
      }
      
      const modelKey = `${providerName.toUpperCase()}_MODEL`;
      const currentModel = setup.envVars[modelKey] || config.defaultModel;
      
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Successfully switched to ${config.name} provider!\n\nModel: ${currentModel}`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to switch to ${providerName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
  completion: async (context: CommandContext, partialArg: string): Promise<string[]> => getProviderManager(context).getAvailableProviders().filter(provider => 
      provider.startsWith(partialArg.toLowerCase())
    ),
};

// New setup command
const providerSetupCommand: SlashCommand = {
  name: 'setup',
  description: 'Setup a provider with API key',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn> => {
    const parts = args.trim().split(' ');
    const providerName = parts[0]?.toLowerCase();
    const apiKey = parts[1];
    
    if (!providerName) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /provider setup <provider-name> <api-key>\nAvailable providers: ' + getProviderManager(context).getAvailableProviders().join(', '),
      };
    }

    const config = getProviderManager(context).getProviderConfig(providerName);
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Unknown provider: ${providerName}\nAvailable providers: ${getProviderManager(context).getAvailableProviders().join(', ')}`,
      };
    }

    // If no API key provided, show current status
    if (!apiKey) {
      const settingsProvider = getProviderManager(context).getProviderFromSettings(config.authType);
      if (settingsProvider?.apiKey) {
        const displayKey = '***' + settingsProvider.apiKey.slice(-4);
        return {
          type: 'message',
          messageType: 'info',
          content: `✅ ${config.name} is already configured!\n\nAPI Key: ${displayKey}\nModel: ${settingsProvider.model || config.defaultModel}\n\nUse "/provider switch ${providerName}" to activate this provider.`
        };
      } else {
        return {
          type: 'message',
          messageType: 'error',
          content: `Usage: /provider setup ${providerName} <api-key>\n\nGet your API key from: ${config.apiKeyUrl}`
        };
      }
    }

    // Validate API key format
    if (!getProviderManager(context).validateApiKeyFormat(providerName, apiKey)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Invalid API key format for ${config.name}.\nExpected format: ${config.apiKeyFormat}\n\nGet your API key from: ${config.apiKeyUrl}`
      };
    }

    // Save to settings
    try {
      getProviderManager(context).saveProviderToSettings(providerName, apiKey);
      
      // Sync settings to environment variables immediately
      getProviderManager(context).syncSettingsToEnv();
      
      // Update selected auth type
      const settings = context.services.settings;
      if (settings) {
        settings.setValue(SettingScope.User, 'security.auth.selectedType', config.authType as AuthType);
      }

      const displayKey = '***' + apiKey.slice(-4);
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Successfully configured ${config.name}!\n\nAPI Key: ${displayKey}\nModel: ${config.defaultModel}\n\nUse "/provider switch ${providerName}" to activate this provider.`
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to save provider configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
  completion: async (context: CommandContext, partialArg: string): Promise<string[]> => getProviderManager(context).getAvailableProviders().filter(provider => 
      provider.startsWith(partialArg.toLowerCase())
    ),
};

// Enhanced status command
const providerStatusCommand: SlashCommand = {
  name: 'status',
  description: 'Show current provider status and configuration',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<SlashCommandActionReturn> => {
    const config = context.services.config;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    const contentConfig = config.getContentGeneratorConfig();
    const currentAuthType = contentConfig?.authType;
    const currentModel = config.getModel();

    // Find current provider
    const currentProvider = getProviderManager(context).getCurrentProviderFromAuthType(currentAuthType || '');
    const setup = currentProvider ? getProviderManager(context).checkProviderSetup(currentProvider) : null;

    let message = '📊 Current Provider Status:\n\n';
    message += `  Provider: ${currentProvider ? getProviderManager(context).getProviderConfig(currentProvider)?.name : 'Unknown'}\n`;
    message += `  Auth Type: ${currentAuthType}\n`;
    message += `  Model: ${currentModel}\n`;
    message += `  Configuration: ${setup?.configured ? '✅ Complete' : '❌ Incomplete'}\n`;

    if (setup?.configured) {
      message += '\n📋 Environment Variables:\n';
      const providerConfig = getProviderManager(context).getProviderConfig(currentProvider!);
      if (providerConfig) {
        for (const varName of [...providerConfig.requiredEnvVars, ...providerConfig.optionalEnvVars]) {
          const value = setup.envVars[varName];
          if (value) {
            const displayValue = varName.includes('KEY') ? '***' + value.slice(-4) : value;
            message += `  ${varName}: ${displayValue}\n`;
          }
        }
      }
    } else if (setup) {
      message += '\n❌ Missing Configuration:\n';
      message += setup.missingVars.map(varName => `  • ${varName}`).join('\n');
      message += '\n💡 Run "/provider setup ' + currentProvider + '" to configure.';
    }

    const envFilePath = getProviderManager(context).getEnvFilePath();
    if (envFilePath) {
      message += `\n\n📁 .env file: ${envFilePath}`;
    }

    // Add model update status
    const updateStatus = getProviderManager(context).getModelUpdateStatus();
    if (Object.keys(updateStatus).length > 0) {
      message += '\n\n🔄 Model Update Status:\n';
      for (const [provider, status] of Object.entries(updateStatus)) {
        const statusIcon = status.needsUpdate ? '🔄' : '✅';
        const lastUpdated = status.lastUpdated ? new Date(status.lastUpdated).toLocaleDateString() : 'Never';
        message += `  ${statusIcon} ${provider}: ${status.needsUpdate ? 'Needs update' : 'Up to date'} (${lastUpdated})\n`;
      }
    }

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };
  },
};

// New discover command
const providerDiscoverCommand: SlashCommand = {
  name: 'discover',
  description: 'Discover and update available models for a provider',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn> => {
    const providerName = args.trim().toLowerCase();
    
    if (!providerName) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /provider discover <provider-name>\nAvailable providers: ' + providerManager.getAvailableProviders().join(', '),
      };
    }

    const config = providerManager.getProviderConfig(providerName);
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Unknown provider: ${providerName}\nAvailable providers: ${providerManager.getAvailableProviders().join(', ')}`,
      };
    }

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `🔍 Discovering models for ${config.name}...`,
      },
      Date.now(),
    );

    const result = await providerManager.discoverModels(providerName);
    
    if (result.success) {
      // Get updated model list
      const updatedConfig = providerManager.getProviderConfig(providerName);
      const modelCount = updatedConfig?.models?.length || 0;
      
      return {
        type: 'message',
        messageType: 'info',
        content: `${result.message}\n\n📋 Available models (${modelCount}):\n${updatedConfig?.models?.map(model => `  • ${model}`).join('\n') || 'No models found'}`,
      };
    } else {
      return {
        type: 'message',
        messageType: 'error',
        content: result.message,
      };
    }
  },
  completion: async (context: CommandContext, partialArg: string): Promise<string[]> => getProviderManager(context).getAvailableProviders().filter(provider => 
      provider.startsWith(partialArg.toLowerCase())
    ),
};

// New update command
const providerUpdateCommand: SlashCommand = {
  name: 'update',
  description: 'Update all provider models that need updating',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<SlashCommandActionReturn> => {
    const updateStatus = providerManager.getModelUpdateStatus();
    const providersNeedingUpdate = Object.entries(updateStatus)
      .filter(([_, status]) => status.needsUpdate)
      .map(([provider, _]) => provider);

    if (providersNeedingUpdate.length === 0) {
      return {
        type: 'message',
        messageType: 'info',
        content: '✅ All provider models are up to date!',
      };
    }

    let message = `🔄 Updating models for ${providersNeedingUpdate.length} provider(s)...\n\n`;
    const results: string[] = [];

    for (const provider of providersNeedingUpdate) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Updating ${provider} models...`,
        },
        Date.now(),
      );

      const result = await providerManager.discoverModels(provider);
      const statusIcon = result.success ? '✅' : '❌';
      results.push(`${statusIcon} ${provider}: ${result.message}`);
    }

    message += results.join('\n');

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };
  },
};

// New model command for switching models within a provider (especially Ollama)
const providerModelCommand: SlashCommand = {
  name: 'model',
  description: 'Switch model for the current provider or list available models',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn> => {
    const modelName = args.trim();
    
    // Get current provider
    const config = context.services.config;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    const contentConfig = config.getContentGeneratorConfig();
    const currentAuthType = contentConfig?.authType;
    const currentProvider = providerManager.getCurrentProviderFromAuthType(currentAuthType || '');
    
    if (!currentProvider) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'No active provider found. Use "/provider switch <provider>" first.',
      };
    }

    // If no model specified, list available models
    if (!modelName) {
      if (currentProvider === 'ollama') {
        try {
          const ollamaBaseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
          const response = await fetch(`${ollamaBaseUrl}/api/tags`);
          if (!response.ok) {
            throw new Error('Failed to fetch Ollama models');
          }
          
          const data = await response.json();
          const models = data.models || [];
          
          let message = `🤖 Available Ollama Models:\n\n`;
          let index = 1;
          for (const model of models) {
            const isCurrent = model.name === process.env['OLLAMA_MODEL'];
            const marker = isCurrent ? ' (current)' : '';
            const size = (model.size / (1024 * 1024 * 1024)).toFixed(1);
            message += `  ${index}. ${isCurrent ? '→ ' : '  '}${model.name}${marker}\n`;
            message += `     Size: ${size} GB, Modified: ${new Date(model.modified_at).toLocaleDateString()}\n\n`;
            index++;
          }
          
          message += '💡 To switch models, type: /provider model <model-name>\n';
          message += '📝 Examples:\n';
          message += '   /provider model gemma2:latest\n';
          message += '   /provider model deepseek-r1:8b\n';
          message += '\n💨 Tip: Use Tab completion when typing the model name!';
          
          return {
            type: 'message',
            messageType: 'info',
            content: message,
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to fetch Ollama models: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      } else {
        const providerConfig = providerManager.getProviderConfig(currentProvider);
        if (!providerConfig) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Provider configuration not found for ${currentProvider}`,
          };
        }

        let message = `🤖 Available ${providerConfig.name} Models:\n\n`;
        let index = 1;
        for (const model of providerConfig.models) {
          const envKey = `${currentProvider.toUpperCase()}_MODEL`;
          const currentModel = process.env[envKey] || providerConfig.defaultModel;
          const isCurrent = model === currentModel;
          const marker = isCurrent ? ' (current)' : '';
          message += `  ${index}. ${isCurrent ? '→ ' : '  '}${model}${marker}\n`;
          index++;
        }
        
        message += `\n💡 To switch models, type: /provider model <model-name>\n`;
        message += `📝 Example: /provider model ${providerConfig.models[0]}\n`;
        message += `\n💨 Tip: Use Tab completion when typing the model name!`;
        
        return {
          type: 'message',
          messageType: 'info',
          content: message,
        };
      }
    }

    // Switch to specified model
    if (currentProvider === 'ollama') {
      // For Ollama, verify the model exists
      try {
        const ollamaBaseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
        const response = await fetch(`${ollamaBaseUrl}/api/tags`);
        if (!response.ok) {
          throw new Error('Failed to connect to Ollama');
        }
        
        const data = await response.json();
        const models = data.models || [];
        const modelExists = models.some((m: any) => m.name === modelName);
        
        if (!modelExists) {
          const availableModels = models.map((m: any) => m.name).join(', ');
          return {
            type: 'message',
            messageType: 'error',
            content: `Model "${modelName}" not found in Ollama.\n\nAvailable models: ${availableModels}\n\n💡 To install a model: ollama pull ${modelName}`,
          };
        }
        
        // Update environment variable and refresh auth
        process.env['OLLAMA_MODEL'] = modelName;
        
        // Update the .env file
        const envFilePath = providerManager.getEnvFilePath();
        if (envFilePath) {
          const { readFileSync, writeFileSync, existsSync } = await import('fs');
          
          let envContent = '';
          if (existsSync(envFilePath)) {
            envContent = readFileSync(envFilePath, 'utf-8');
          }
          
          const lines = envContent.split('\n');
          let updated = false;
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('OLLAMA_MODEL=')) {
              lines[i] = `OLLAMA_MODEL="${modelName}"`;
              updated = true;
              break;
            }
          }
          
          if (!updated) {
            lines.push(`OLLAMA_MODEL="${modelName}"`);
          }
          
          writeFileSync(envFilePath, lines.filter(line => line.trim()).join('\n') + '\n');
        }
        
        // Refresh the auth to use the new model
        const currentProviderConfig = providerManager.getProviderConfig('ollama');
        if (currentProviderConfig) {
          await config.refreshAuth(currentProviderConfig.authType as any);
        }
        
        return {
          type: 'message',
          messageType: 'info',
          content: `✅ Successfully switched to Ollama model: ${modelName}`,
        };
        
      } catch (error) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Failed to switch Ollama model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else {
      // For other providers, just update the environment variable
      const providerConfig = providerManager.getProviderConfig(currentProvider);
      if (!providerConfig) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Provider configuration not found for ${currentProvider}`,
        };
      }

      if (!providerConfig.models.includes(modelName)) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Model "${modelName}" not available for ${providerConfig.name}.\n\nAvailable models: ${providerConfig.models.join(', ')}`,
        };
      }

      const envKey = `${currentProvider.toUpperCase()}_MODEL`;
      process.env[envKey] = modelName;
      
      // Update the .env file
      const envFilePath = providerManager.getEnvFilePath();
      if (envFilePath) {
        const { readFileSync, writeFileSync, existsSync } = await import('fs');
        
        let envContent = '';
        if (existsSync(envFilePath)) {
          envContent = readFileSync(envFilePath, 'utf-8');
        }
        
        const lines = envContent.split('\n');
        let updated = false;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith(`${envKey}=`)) {
            lines[i] = `${envKey}="${modelName}"`;
            updated = true;
            break;
          }
        }
        
        if (!updated) {
          lines.push(`${envKey}="${modelName}"`);
        }
        
        writeFileSync(envFilePath, lines.filter(line => line.trim()).join('\n') + '\n');
      }
      
      // Refresh auth to use new model
      await config.refreshAuth(providerConfig.authType as any);
      
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Successfully switched to ${providerConfig.name} model: ${modelName}`,
      };
    }
  },
  completion: async (context: CommandContext, partialArg: string): Promise<string[]> => {
    // Auto-completion for models
    const config = context.services.config;
    if (!config) return [];

    const contentConfig = config.getContentGeneratorConfig();
    const currentAuthType = contentConfig?.authType;
    const currentProvider = providerManager.getCurrentProviderFromAuthType(currentAuthType || '');
    
    if (!currentProvider) return [];
    
    if (currentProvider === 'ollama') {
      try {
        const ollamaBaseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
        const response = await fetch(`${ollamaBaseUrl}/api/tags`);
        if (!response.ok) return [];
        
        const data = await response.json();
        const models = data.models || [];
        return models
          .map((m: any) => m.name)
          .filter((name: string) => name.startsWith(partialArg))
          .slice(0, 10); // Limit suggestions
      } catch {
        return [];
      }
    } else {
      const providerConfig = providerManager.getProviderConfig(currentProvider);
      if (!providerConfig) return [];
      
      return providerConfig.models
        .filter(model => model.startsWith(partialArg))
        .slice(0, 10);
    }
  },
};

export const providerCommand: SlashCommand = {
  name: 'provider',
  description: 'Manage AI providers - switch between different AI services',
  kind: CommandKind.BUILT_IN,
  subCommands: [providerListCommand, providerSwitchCommand, providerSetupCommand, providerStatusCommand, providerModelCommand, providerDiscoverCommand, providerUpdateCommand],
  action: async (context: CommandContext): Promise<SlashCommandActionReturn> => {
    // Default action when no subcommand is provided - show list
    const result = await providerListCommand.action!(context, '');
    if (result) {
      return result;
    }
    // Fallback if the action returns void
    return {
      type: 'message',
      messageType: 'info',
      content: 'Provider command executed successfully.',
    };
  },
};
