/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import { GoogleGenAI } from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL } from '../config/models.js';
import type { Config } from '../config/config.js';

import type { UserTierId } from '../code_assist/types.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { InstallationManager } from '../utils/installationManager.js';
import type { ModelProviderConfig } from './model-providers/index.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_OPENAI = 'openai-api-key',
  USE_ANTHROPIC = 'anthropic-api-key',
  USE_OLLAMA = 'ollama-local',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType;
  proxy?: string;
  provider?: string;
  providerConfig?: Record<string, any>;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  
  const geminiApiKey = process.env['GEMINI_API_KEY'] || undefined;
  const googleApiKey = process.env['GOOGLE_API_KEY'] || undefined;
  const googleCloudProject = process.env['GOOGLE_CLOUD_PROJECT'] || undefined;
  const googleCloudLocation = process.env['GOOGLE_CLOUD_LOCATION'] || undefined;

  // Initialize config with basic settings - model will be set based on auth type
  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: '', // Will be set based on provider
    authType,
    proxy: config?.getProxy(),
  };

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    contentGeneratorConfig.model = config.getModel() || DEFAULT_GEMINI_MODEL;
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;
    contentGeneratorConfig.model = config.getModel() || DEFAULT_GEMINI_MODEL;

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;
    contentGeneratorConfig.model = config.getModel() || DEFAULT_GEMINI_MODEL;

    return contentGeneratorConfig;
  }

  // Handle new auth types by setting up provider configuration
  if (authType === AuthType.USE_OPENAI) {
    const openaiApiKey = process.env['OPENAI_API_KEY'] || undefined;
    const openaiModel = process.env['OPENAI_MODEL'] || 'gpt-4';
    const openaiBaseUrl = process.env['OPENAI_BASE_URL'] || undefined;

    contentGeneratorConfig.provider = 'openai';
    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.model = openaiModel;
    contentGeneratorConfig.providerConfig = {
      baseUrl: openaiBaseUrl,
    };

    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_ANTHROPIC) {
    const anthropicApiKey = process.env['ANTHROPIC_API_KEY'] || undefined;
    const anthropicModel = process.env['ANTHROPIC_MODEL'] || 'claude-3-opus-20240229';
    const anthropicBaseUrl = process.env['ANTHROPIC_BASE_URL'] || undefined;

    contentGeneratorConfig.provider = 'anthropic';
    contentGeneratorConfig.apiKey = anthropicApiKey;
    contentGeneratorConfig.model = anthropicModel;
    contentGeneratorConfig.providerConfig = {
      baseUrl: anthropicBaseUrl,
    };

    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_OLLAMA) {
    const ollamaModel = process.env['OLLAMA_MODEL'] || 'llama3.2:latest';
    const ollamaBaseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';


    contentGeneratorConfig.provider = 'ollama';
    contentGeneratorConfig.model = ollamaModel;
    contentGeneratorConfig.providerConfig = {
      baseUrl: ollamaBaseUrl,
    };

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env['CLI_VERSION'] || process.version;
  const userAgent = `GeminiCLI/${version} (${process.platform}; ${process.arch})`;
  const baseHeaders: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    const httpOptions = { headers: baseHeaders };
    return new LoggingContentGenerator(
      await createCodeAssistContentGenerator(
        httpOptions,
        config.authType,
        gcConfig,
        sessionId,
      ),
      gcConfig,
    );
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    let headers: Record<string, string> = { ...baseHeaders };
    if (gcConfig?.getUsageStatisticsEnabled()) {
      const installationManager = new InstallationManager();
      const installationId = installationManager.getInstallationId();
      headers = {
        ...headers,
        'x-gemini-api-privileged-user-id': `${installationId}`,
      };
    }
    const httpOptions = { headers };

    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });
    return new LoggingContentGenerator(googleGenAI.models, gcConfig);
  }

  // Handle new auth types using the model provider system
  if (
    config.authType === AuthType.USE_OPENAI ||
    config.authType === AuthType.USE_ANTHROPIC ||
    config.authType === AuthType.USE_OLLAMA
  ) {
    // Map auth types to provider names
    const providerMap: Partial<Record<AuthType, string>> = {
      [AuthType.USE_OPENAI]: 'openai',
      [AuthType.USE_ANTHROPIC]: 'anthropic',
      [AuthType.USE_OLLAMA]: 'ollama',
    };

    const providerName = providerMap[config.authType];
    if (!providerName) {
      throw new Error(`Unknown auth type: ${config.authType}`);
    }

    // Create provider config
    const providerConfig: ModelProviderConfig = {
      provider: providerName,
      model: config.model,
      apiKey: config.apiKey,
      ...config.providerConfig,
    };

    // Import and use the model provider registry
    const { ModelProviderRegistry } = await import('./model-providers/provider-registry.js');
    const registry = new ModelProviderRegistry();
    
    if (!registry.hasProvider(providerName)) {
      throw new Error(`Provider ${providerName} not available. Available providers: ${registry.getAvailableProviders().join(', ')}`);
    }

    const provider = registry.createProvider(providerConfig, gcConfig);
    return new LoggingContentGenerator(provider, gcConfig);
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
