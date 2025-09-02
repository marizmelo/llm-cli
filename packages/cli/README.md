# LLM CLI

Multi-provider AI assistant for the command line supporting OpenAI, Anthropic Claude, Ollama, and more - now with full tool/function calling support!

## Installation

```bash
npm install -g @marizmelo/llm-cli
```

## Usage

```bash
llm-cli
```

For non-interactive mode:
```bash
llm-cli --prompt "What is 2+2?"
```

## Features

- 🤖 Multi-provider support (OpenAI, Anthropic, Ollama, Gemini)
- 🔧 Interactive CLI interface with full tool/function support
- 📁 Context-aware file processing
- 🔌 Extensible with custom commands
- 🎯 Provider-specific model switching
- 💾 Memory and context management
- 🔑 Secure API key management with persistent settings
- 🛠️ Full tool/function calling support for OpenAI and Anthropic

## What's New in v0.1.0

### Major Enhancements
- **🛠️ Full Tool Support**: OpenAI and Anthropic providers now have complete function/tool calling capabilities
- **🔑 Persistent API Keys**: API keys are saved to settings and automatically loaded on startup
- **⚡ Improved Setup**: Streamlined provider configuration with `/provider setup` command
- **🐛 Bug Fixes**: Resolved streaming issues and improved error handling

## Provider Setup

### Quick Setup (Recommended)
```bash
# Start the CLI
llm-cli

# Setup providers with API keys (keys are saved securely)
/provider setup openai sk-your-api-key
/provider setup anthropic sk-ant-your-api-key

# Switch to your preferred provider
/provider switch openai
```

### Available Commands
- `/provider list` - Show all available providers and their status
- `/provider setup <provider> [api-key]` - Configure a provider
- `/provider switch <provider>` - Switch to a different provider
- `/provider status` - Show current provider status
- `/provider discover <provider>` - Discover available models

### Ollama (Local)
```bash
# Install Ollama first from https://ollama.ai
# Then in llm-cli:
/provider switch ollama
```

### Environment Variables (Legacy)
```bash
# Still supported for backward compatibility
export OPENAI_API_KEY="your-api-key"
export ANTHROPIC_API_KEY="your-api-key"
llm-cli
```

## Documentation

For full documentation, visit: https://github.com/marizmelo/llm-cli

## License

Apache-2.0