#!/usr/bin/env node

/**
 * Multi-Provider Demo
 * 
 * This script demonstrates how to use different AI providers with the Gemini CLI.
 * It shows how to configure and use OpenAI, Anthropic, and Ollama providers.
 */

import { ModelProviderRegistry } from '../packages/core/dist/src/core/model-providers/provider-registry.js';

async function demoMultiProvider() {
  console.log('🤖 Multi-Provider Demo\n');

  // Create the provider registry
  const registry = new ModelProviderRegistry();
  
  console.log('Available providers:', registry.getAvailableProviders());
  console.log('');

  // Example configurations for different providers
  const configs = [
    {
      name: 'OpenAI',
      config: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'demo-key',
        model: 'gpt-4',
        baseUrl: 'https://api.openai.com/v1'
      }
    },
    {
      name: 'Ollama (Local)',
      config: {
        provider: 'ollama',
        model: 'llama2',
        baseUrl: 'http://localhost:11434'
      }
    }
  ];

  for (const { name, config } of configs) {
    console.log(`📋 Testing ${name} provider:`);
    
    try {
      // Check if provider is available
      if (!registry.hasProvider(config.provider)) {
        console.log(`   ❌ Provider '${config.provider}' not available`);
        continue;
      }

      // Validate configuration
      const provider = registry.createProvider(config);
      const isValid = provider.validateConfig(config);
      
      console.log(`   ✅ Provider available: ${isValid}`);
      console.log(`   📝 Provider name: ${provider.name}`);
      
      if (isValid) {
        console.log(`   🎯 Ready to use ${name}!`);
      } else {
        console.log(`   ⚠️  Configuration invalid for ${name}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error with ${name}: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🚀 Usage Examples:');
  console.log('');
  console.log('1. Set environment variables:');
  console.log('   export OPENAI_API_KEY="your-openai-key"');
  console.log('   export OPENAI_MODEL="gpt-4"');
  console.log('');
  console.log('2. Start the CLI and choose your provider:');
  console.log('   gemini');
  console.log('');
  console.log('3. For Ollama (local models):');
  console.log('   # Install and start Ollama');
  console.log('   curl -fsSL https://ollama.ai/install.sh | sh');
  console.log('   ollama serve');
  console.log('   ollama pull llama2');
  console.log('   export OLLAMA_MODEL="llama2"');
  console.log('   gemini  # Choose "Use Ollama (Local Models)"');
}

// Run the demo
demoMultiProvider().catch(console.error);
