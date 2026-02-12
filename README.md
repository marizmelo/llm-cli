# LLM CLI

LLM-CLI is a command-line AI assistant that's a fork of Gemini Cli. Unlike its predecessor, LLM-CLI is a multi-provider tool that supports Gemini, OpenAI, Anthropic Claude, Ollama, and more, making it a powerful agent for coding. This means you can now use all of Gemini Cli’s powerful features with your preferred large language model—whether it's running in the cloud or locally.

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

### Enhanced Provider Support
- **OpenAI & Anthropic Tool Support**: Both providers now have full function/tool calling capabilities, allowing them to use all available CLI tools (file operations, shell commands, web searches, etc.)
- **Persistent API Key Management**: API keys are now saved to settings and automatically synced to environment variables on startup
- **Improved Provider Setup**: Simplified setup process with `/provider setup <provider> <api-key>` command
- **Better Error Handling**: Fixed streaming response issues and improved error messages

### Provider Setup

#### Quick Setup (New Method)
```bash
# Setup providers with persistent API keys
llm-cli
/provider setup openai sk-your-api-key
/provider setup anthropic sk-ant-your-api-key
/provider switch openai
```

#### Ollama (Local)
```bash
# 1. Install Ollama (https://ollama.com)
# 2. Pull a model
ollama pull llama3.2:latest

# 3. Start llm-cli and switch to Ollama
llm-cli
/provider switch ollama

# 4. (Optional) Switch to a different model
/provider model <model-name>
```
The default model is `llama3.2:latest`. Use `/provider model` to list available models and switch between them.

#### Traditional Setup (Environment Variables)
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