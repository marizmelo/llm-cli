# Multi-Provider Usage Guide

This guide explains how to use the enhanced multi-provider system in LLM-CLI, which allows you to switch between different AI services seamlessly.

## Overview

The enhanced system provides:

- **JSON-based provider configuration** (`.gemini/providers.json`)
- **Automatic .env file detection** and management
- **API key validation** with format checking
- **Interactive setup guidance** for each provider
- **Real-time status checking** and configuration validation

## Quick Start

### 1. List Available Providers

```bash
/provider list
```

This shows all available providers with their setup status:

```
🤖 Available AI Providers:

  → Google (Gemini) (current)
    Google's latest AI models
    Status: ✅ Configured
    Model: gemini-1.5-pro-latest

  OpenAI
    GPT-4, GPT-3.5-turbo, and other models
    Status: ❌ Not configured

  Anthropic
    Claude models
    Status: ❌ Not configured

  Ollama (Local)
    Local models via Ollama
    Status: ❌ Not configured

📋 Commands:
  /provider switch <provider>  - Switch to a provider
  /provider setup <provider>  - Interactive setup
  /provider status           - Show current status
```

### 2. Switch to a Provider

```bash
/provider switch openai
```

If the provider is not configured, you'll see setup instructions:

```
🔧 Setting up OpenAI...

📋 Requirements:
  • API Key: Format: sk-*
  • Get API key from: https://platform.openai.com/api-keys

❌ Missing required environment variables:
  • OPENAI_API_KEY

💡 To complete setup:
  1. Get your API key from https://platform.openai.com/api-keys
  2. Add to your .env file:
     OPENAI_API_KEY="your-api-key"
  3. Run "/provider switch openai"
```

### 3. Check Current Status

```bash
/provider status
```

Shows detailed information about your current provider:

```
📊 Current Provider Status:

  Provider: OpenAI
  Auth Type: USE_OPENAI
  Model: gpt-4
  Configuration: ✅ Complete

📋 Environment Variables:
  OPENAI_API_KEY: ***abcd
  OPENAI_MODEL: gpt-4

📁 .env file: /path/to/project/.gemini/.env
```

## Provider Configuration

The system uses a JSON configuration file (`.gemini/providers.json`) that defines all available providers:

```json
{
  "providers": {
    "openai": {
      "name": "OpenAI",
      "description": "GPT-4, GPT-3.5-turbo, and other models",
      "authType": "USE_OPENAI",
      "requiredEnvVars": ["OPENAI_API_KEY"],
      "optionalEnvVars": ["OPENAI_MODEL", "OPENAI_BASE_URL"],
      "defaultModel": "gpt-4",
      "apiKeyFormat": "sk-*",
      "apiKeyUrl": "https://platform.openai.com/api-keys",
      "models": ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-3.5-turbo"]
    }
  }
}
```

### Configuration Fields

- **name**: Display name for the provider
- **description**: Brief description of the provider
- **authType**: Internal authentication type identifier
- **requiredEnvVars**: Environment variables that must be set
- **optionalEnvVars**: Optional environment variables
- **defaultModel**: Default model to use if not specified
- **apiKeyFormat**: Expected format for API keys (for validation)
- **apiKeyUrl**: URL where users can get API keys
- **models**: List of available models for this provider

## Environment Variables

Each provider requires specific environment variables. The system automatically detects `.env` files in the following order:

1. `.gemini/.env` in current directory
2. `.env` in current directory  
3. `~/.gemini/.env` in home directory
4. `~/.env` in home directory

### Required Variables by Provider

#### OpenAI
```bash
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4  # optional
OPENAI_BASE_URL=https://api.openai.com/v1  # optional
```

#### Anthropic
```bash
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
ANTHROPIC_MODEL=claude-3-opus-20240229  # optional
ANTHROPIC_BASE_URL=https://api.anthropic.com  # optional
```

#### Google (Gemini)
```bash
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-pro-latest  # optional
```

#### Ollama (Local)
```bash
OLLAMA_MODEL=llama2
OLLAMA_BASE_URL=http://localhost:11434  # optional
```

## Setup Process

### Automatic Setup

The enhanced system provides intelligent setup guidance:

1. **Check Configuration**: `/provider setup <provider>` shows what's needed
2. **Get API Key**: Follow the provided link to get your API key
3. **Add to .env**: Add the required environment variables
4. **Switch Provider**: `/provider switch <provider>` activates the provider

### Manual Setup

1. Create a `.gemini/.env` file in your project:
   ```bash
   mkdir -p .gemini
   touch .gemini/.env
   ```

2. Add your API keys:
   ```bash
   echo 'OPENAI_API_KEY="sk-your-key-here"' >> .gemini/.env
   echo 'ANTHROPIC_API_KEY="sk-ant-your-key-here"' >> .gemini/.env
   ```

3. Switch to your preferred provider:
   ```bash
   /provider switch openai
   ```

## Advanced Features

### API Key Validation

The system validates API key formats:
- OpenAI: Must start with `sk-`
- Anthropic: Must start with `sk-ant-`
- Google: Alphanumeric characters only
- Ollama: No API key required

### Model Selection

You can specify different models via environment variables:

```bash
# Use GPT-4 Turbo
OPENAI_MODEL=gpt-4-turbo

# Use Claude Sonnet
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Use local Llama 3
OLLAMA_MODEL=llama3
```

### Custom Endpoints

For self-hosted or custom endpoints:

```bash
# Custom OpenAI-compatible endpoint
OPENAI_BASE_URL=https://your-custom-endpoint.com/v1

# Custom Anthropic endpoint
ANTHROPIC_BASE_URL=https://your-anthropic-endpoint.com
```

## Troubleshooting

### Common Issues

**"Provider not configured"**
- Check that your `.env` file exists and contains the required variables
- Verify API key format matches the expected format
- Use `/provider setup <provider>` for detailed guidance

**"API key not found"**
- Ensure your `.env` file is in the correct location
- Check that the variable name matches exactly (case-sensitive)
- Restart the CLI after adding new environment variables

**"Unknown provider"**
- Verify the provider name is correct (openai, anthropic, google, ollama)
- Check that `.gemini/providers.json` exists and is valid JSON

### Debugging

Use `/provider status` to see:
- Current provider configuration
- Environment variable status
- Missing configuration items
- .env file location

## Migration from Previous Versions

If you're upgrading from a previous version:

1. Your existing `.env` files will continue to work
2. The new system will automatically detect your current configuration
3. Use `/provider status` to verify your setup
4. The enhanced commands provide better guidance for adding new providers

## Reference

- [Authentication Guide](./authentication.md) - Detailed authentication setup
- [Configuration Guide](./configuration.md) - Environment variables and settings
- [Commands Reference](./commands.md) - Complete command documentation
