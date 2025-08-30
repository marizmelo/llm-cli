# Multi-Provider Implementation for Gemini CLI

This document describes the implementation of multi-provider support for the Gemini CLI, allowing it to work with various AI providers beyond Google's services, including local models through Ollama.

## 🎯 Overview

The implementation adds support for multiple AI providers while maintaining backward compatibility with existing Google services. Users can now seamlessly switch between different AI models based on their needs.

## 🏗️ Architecture

### Core Components

1. **Model Provider Abstraction** (`packages/core/src/core/model-providers/`)
   - `index.ts` - Main interfaces and types
   - `provider-registry.ts` - Provider management and registration
   - `openai-provider.ts` - OpenAI API integration
   - `ollama-provider.ts` - Local models via Ollama
   - `google-provider.ts` - Google services (existing functionality)

2. **Integration Points**
   - `contentGenerator.ts` - Updated to support multiple providers
   - `AuthDialog.tsx` - New authentication options
   - `auth.ts` - Provider-specific validation
   - `settingsSchema.ts` - Configuration options

## 🚀 Supported Providers

### 1. Google Services (Existing)
- **Gemini API** - Google's latest AI models
- **Vertex AI** - Enterprise AI platform
- **Code Assist** - OAuth-based service

### 2. OpenAI
- **Models**: GPT-4, GPT-3.5-turbo, etc.
- **Features**: Chat completions, embeddings, streaming
- **Configuration**: API key, custom base URL

### 3. Anthropic
- **Models**: Claude-3 series
- **Features**: Constitutional AI, long context
- **Configuration**: API key, custom base URL

### 4. Ollama (Local Models)
- **Models**: Llama, Mistral, and other local models
- **Features**: Privacy-focused, no API costs
- **Configuration**: Model name, Ollama server URL

## 📋 Configuration

### Environment Variables

```bash
# OpenAI
export OPENAI_API_KEY="sk-your-openai-key"
export OPENAI_MODEL="gpt-4"
export OPENAI_BASE_URL="https://api.openai.com/v1"

# Anthropic
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
export ANTHROPIC_MODEL="claude-3-opus-20240229"

# Ollama
export OLLAMA_MODEL="llama2"
export OLLAMA_BASE_URL="http://localhost:11434"
```

### Settings Configuration

```json
{
  "model": {
    "provider": "openai",
    "name": "gpt-4",
    "providerConfig": {
      "baseUrl": "https://api.openai.com/v1"
    }
  }
}
```

## 🔧 Usage Examples

### Using OpenAI

```bash
# Set environment variables
export OPENAI_API_KEY="sk-your-key"
export OPENAI_MODEL="gpt-4"

# Start CLI and choose "Use OpenAI API Key"
gemini
```

### Using Ollama (Local Models)

```bash
# Install and start Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve

# Pull a model
ollama pull llama2

# Set environment variable
export OLLAMA_MODEL="llama2"

# Start CLI and choose "Use Ollama (Local Models)"
gemini
```

### Using Anthropic

```bash
# Set environment variables
export ANTHROPIC_API_KEY="sk-ant-your-key"
export ANTHROPIC_MODEL="claude-3-opus-20240229"

# Start CLI and choose "Use Anthropic API Key"
gemini
```

## 🏛️ Technical Implementation

### Provider Interface

```typescript
interface ModelProvider extends ContentGenerator {
  name: string;
  validateConfig(config: ModelProviderConfig): boolean;
}
```

### Provider Registry

```typescript
class ModelProviderRegistry {
  register(name: string, providerClass: ProviderClass): void;
  createProvider(config: ModelProviderConfig): ModelProvider;
  getAvailableProviders(): string[];
  hasProvider(name: string): boolean;
}
```

### Authentication Types

```typescript
enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_OPENAI = 'openai-api-key',
  USE_ANTHROPIC = 'anthropic-api-key',
  USE_OLLAMA = 'ollama-local',
}
```

## 🔄 Backward Compatibility

- All existing Google services continue to work unchanged
- Existing configuration files remain valid
- No breaking changes to the CLI interface
- Gradual migration path for users

## 🧪 Testing

The implementation includes comprehensive tests:

```bash
# Run provider registry tests
npm test -- packages/core/src/core/model-providers/provider-registry.test.ts

# Run all tests
npm test
```

## 📚 Documentation

- `docs/cli/multi-provider-usage.md` - Complete usage guide
- `docs/cli/configuration.md` - Updated configuration documentation
- `examples/multi-provider-demo.js` - Demonstration script

## 🔮 Future Enhancements

1. **Additional Providers**
   - Azure OpenAI
   - Cohere
   - Local models (LM Studio, etc.)

2. **Advanced Features**
   - Model routing and fallback
   - Provider-specific optimizations
   - Cost tracking and budgeting

3. **Integration Improvements**
   - Provider-specific tool support
   - Custom model fine-tuning
   - Batch processing capabilities

## 🛠️ Development

### Adding a New Provider

1. Create a new provider class implementing `ModelProvider`
2. Register it in the `ModelProviderRegistry`
3. Add authentication type to `AuthType` enum
4. Update validation in `auth.ts`
5. Add UI options in `AuthDialog.tsx`
6. Update documentation

### Example Provider Structure

```typescript
export class NewProvider implements ModelProvider {
  name = 'new-provider';
  
  constructor(config: ModelProviderConfig) {
    // Initialize provider
  }
  
  async generateContent(request: any, userPromptId: string) {
    // Implement content generation
  }
  
  // ... other required methods
  
  validateConfig(config: ModelProviderConfig): boolean {
    return config.provider === 'new-provider' && !!config.apiKey;
  }
}
```

## 🎉 Summary

The multi-provider implementation successfully extends the Gemini CLI to support multiple AI providers while maintaining the existing architecture and user experience. Users can now choose the AI provider that best fits their needs, whether it's Google's services, OpenAI's models, or local models through Ollama.

The implementation is:
- ✅ **Extensible** - Easy to add new providers
- ✅ **Backward Compatible** - Existing functionality preserved
- ✅ **Well-Tested** - Comprehensive test coverage
- ✅ **Well-Documented** - Complete usage guides
- ✅ **Production Ready** - Proper error handling and validation
