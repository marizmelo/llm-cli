/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';
import { MessageType } from '../types.js';
import type { SlashCommand, SlashCommandActionReturn, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { validateAuthMethod } from '../../config/auth.js';

const providerListCommand: SlashCommand = {
  name: 'list',
  description: 'List available AI providers',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<SlashCommandActionReturn> => {
    const providers = [
      { name: 'Google (Gemini)', value: AuthType.USE_GEMINI, description: 'Google\'s latest AI models' },
      { name: 'Google (Vertex AI)', value: AuthType.USE_VERTEX_AI, description: 'Enterprise AI platform' },
      { name: 'Google (Code Assist)', value: AuthType.LOGIN_WITH_GOOGLE, description: 'OAuth-based service' },
      { name: 'OpenAI', value: AuthType.USE_OPENAI, description: 'GPT-4, GPT-3.5-turbo, etc.' },
      { name: 'Anthropic', value: AuthType.USE_ANTHROPIC, description: 'Claude models' },
      { name: 'Ollama (Local)', value: AuthType.USE_OLLAMA, description: 'Local models via Ollama' },
    ];

    let message = 'Available AI providers:\n\n';
    
    for (const provider of providers) {
      const isCurrent = context.services.config?.getContentGeneratorConfig()?.authType === provider.value;
      const status = isCurrent ? ' (current)' : '';
      message += `  ${isCurrent ? '→ ' : '  '}${provider.name}${status}\n`;
      message += `    ${provider.description}\n\n`;
    }

    message += 'Usage: /provider switch <provider-name>\n';
    message += 'Example: /provider switch openai';

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };
  },
};

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
        content: 'Usage: /provider switch <provider-name>\nAvailable providers: google, openai, anthropic, ollama',
      };
    }

    // Map provider names to AuthType
    const providerMap: Record<string, AuthType> = {
      'google': AuthType.USE_GEMINI,
      'gemini': AuthType.USE_GEMINI,
      'vertex': AuthType.USE_VERTEX_AI,
      'vertexai': AuthType.USE_VERTEX_AI,
      'codeassist': AuthType.LOGIN_WITH_GOOGLE,
      'oauth': AuthType.LOGIN_WITH_GOOGLE,
      'openai': AuthType.USE_OPENAI,
      'anthropic': AuthType.USE_ANTHROPIC,
      'claude': AuthType.USE_ANTHROPIC,
      'ollama': AuthType.USE_OLLAMA,
      'local': AuthType.USE_OLLAMA,
    };

    const authType = providerMap[providerName];
    
    if (!authType) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Unknown provider: ${providerName}\nAvailable providers: google, openai, anthropic, ollama`,
      };
    }

    // Validate the auth method
    const validationError = validateAuthMethod(authType);
    if (validationError) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Cannot switch to ${providerName}: ${validationError}`,
      };
    }

    const config = context.services.config;
    if (!config) {
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
          text: `Switching to ${providerName} provider...`,
        },
        Date.now(),
      );

      // Switch the provider
      await config.refreshAuth(authType);

      // Update settings to remember the choice
      const settings = context.services.settings;
      if (settings) {
        settings.setValue('user', 'security.auth.selectedType', authType);
      }

      const providerDisplayName = Object.entries(providerMap).find(([key]) => key === providerName)?.[0] || providerName;
      
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Successfully switched to ${providerDisplayName} provider!`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to switch to ${providerName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
  completion: async (context: CommandContext, partialArg: string): Promise<string[]> => {
    const providers = ['google', 'openai', 'anthropic', 'ollama'];
    return providers.filter(provider => provider.startsWith(partialArg.toLowerCase()));
  },
};

const providerStatusCommand: SlashCommand = {
  name: 'status',
  description: 'Show current provider status',
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
    const currentProvider = contentConfig?.provider || 'google';

    let message = 'Current provider status:\n\n';
    message += `  Provider: ${currentProvider}\n`;
    message += `  Auth Type: ${currentAuthType}\n`;
    message += `  Model: ${currentModel}\n`;

    // Add provider-specific information
    if (currentAuthType === AuthType.USE_OPENAI) {
      const hasApiKey = !!process.env.OPENAI_API_KEY;
      message += `  OpenAI API Key: ${hasApiKey ? '✅ Configured' : '❌ Not configured'}\n`;
    } else if (currentAuthType === AuthType.USE_ANTHROPIC) {
      const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
      message += `  Anthropic API Key: ${hasApiKey ? '✅ Configured' : '❌ Not configured'}\n`;
    } else if (currentAuthType === AuthType.USE_OLLAMA) {
      const model = process.env.OLLAMA_MODEL || 'llama2';
      message += `  Ollama Model: ${model}\n`;
      message += `  Ollama URL: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}\n`;
    }

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
  subCommands: [providerListCommand, providerSwitchCommand, providerStatusCommand],
  action: async (context: CommandContext): Promise<SlashCommandActionReturn> => {
    // Default action when no subcommand is provided - show list
    return providerListCommand.action!(context, '');
  },
};
