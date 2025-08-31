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

const providerManager = new ProviderManager();

// Enhanced list command
const providerListCommand: SlashCommand = {
  name: 'list',
  description: 'List available AI providers with setup status',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<SlashCommandActionReturn> => {
    const providers = providerManager.getAvailableProviders();
    const currentAuthType = context.services.config?.getContentGeneratorConfig()?.authType;

    let message = '🤖 Available AI Providers:\n\n';
    
    for (const providerKey of providers) {
      const config = providerManager.getProviderConfig(providerKey)!;
      const setup = providerManager.checkProviderSetup(providerKey);
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
        content: 'Usage: /provider switch <provider-name>\nAvailable providers: ' + providerManager.getAvailableProviders().join(', '),
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

    // Check if provider is properly configured
    const setup = providerManager.checkProviderSetup(providerName);
    if (!setup.configured) {
      return await providerManager.setupProvider(providerName, context);
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
  completion: async (context: CommandContext, partialArg: string): Promise<string[]> => providerManager.getAvailableProviders().filter(provider => 
      provider.startsWith(partialArg.toLowerCase())
    ),
};

// New setup command
const providerSetupCommand: SlashCommand = {
  name: 'setup',
  description: 'Interactive setup for a provider',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn> => {
    const providerName = args.trim().toLowerCase();
    
    if (!providerName) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /provider setup <provider-name>\nAvailable providers: ' + providerManager.getAvailableProviders().join(', '),
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

    const setup = providerManager.checkProviderSetup(providerName);
    
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
      
      message += `\nUse "/provider switch ${providerName}" to activate this provider.`;
      
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
      message += `  3. Run "/provider switch ${providerName}"\n\n`;
      message += `📝 Or use the interactive setup: /provider setup ${providerName}`;
    }

    return {
      type: 'message',
      messageType: 'info',
      content: message
    };
  },
  completion: async (context: CommandContext, partialArg: string): Promise<string[]> => providerManager.getAvailableProviders().filter(provider => 
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
    const currentProvider = providerManager.getCurrentProviderFromAuthType(currentAuthType || '');
    const setup = currentProvider ? providerManager.checkProviderSetup(currentProvider) : null;

    let message = '📊 Current Provider Status:\n\n';
    message += `  Provider: ${currentProvider ? providerManager.getProviderConfig(currentProvider)?.name : 'Unknown'}\n`;
    message += `  Auth Type: ${currentAuthType}\n`;
    message += `  Model: ${currentModel}\n`;
    message += `  Configuration: ${setup?.configured ? '✅ Complete' : '❌ Incomplete'}\n`;

    if (setup?.configured) {
      message += '\n📋 Environment Variables:\n';
      const providerConfig = providerManager.getProviderConfig(currentProvider!);
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

    const envFilePath = providerManager.getEnvFilePath();
    if (envFilePath) {
      message += `\n\n📁 .env file: ${envFilePath}`;
    }

    // Add model update status
    const updateStatus = providerManager.getModelUpdateStatus();
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
  completion: async (context: CommandContext, partialArg: string): Promise<string[]> => providerManager.getAvailableProviders().filter(provider => 
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

export const providerCommand: SlashCommand = {
  name: 'provider',
  description: 'Manage AI providers - switch between different AI services',
  kind: CommandKind.BUILT_IN,
  subCommands: [providerListCommand, providerSwitchCommand, providerSetupCommand, providerStatusCommand, providerDiscoverCommand, providerUpdateCommand],
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
