/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider, ModelProviderConfig } from './index.js';
import type { ContentGenerator } from '../contentGenerator.js';
import type { Config } from '../../config/config.js';

/**
 * Google AI provider implementation using Google GenAI.
 */
export class GoogleProvider implements ModelProvider {
  name = 'google';
  private contentGenerator: ContentGenerator;

  constructor(config: ModelProviderConfig, gcConfig?: Config) {
    // This will be implemented by importing the actual GoogleGenAI when available
    // For now, we'll create a placeholder that throws an error
    throw new Error('GoogleProvider not yet implemented - requires @google/genai import');
  }

  async generateContent(request: any, userPromptId: string) {
    return this.contentGenerator.generateContent(request, userPromptId);
  }

  async generateContentStream(request: any, userPromptId: string) {
    return this.contentGenerator.generateContentStream(request, userPromptId);
  }

  async countTokens(request: any) {
    return this.contentGenerator.countTokens(request);
  }

  async embedContent(request: any) {
    return this.contentGenerator.embedContent(request);
  }

  get userTier() {
    return this.contentGenerator.userTier;
  }

  validateConfig(config: ModelProviderConfig): boolean {
    return config.provider === 'google' && !!config.apiKey;
  }
}
