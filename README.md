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
- 🛠️ Full tool/function calling support for OpenAI, Anthropic, and Ollama

## Provider Setup

### Quick Setup
```bash
# Setup cloud providers with persistent API keys
llm-cli
/provider setup openai sk-your-api-key
/provider setup anthropic sk-ant-your-api-key
/provider switch openai
```

### Ollama (Local)
```bash
# 1. Install Ollama (https://ollama.com)
# 2. Pull a tool-capable model
ollama pull qwen2.5:latest

# 3. Start llm-cli and switch to Ollama
llm-cli
/provider switch ollama

# 4. (Optional) Switch to a different model
/provider model <model-name>
```

No `.env` file or environment variables required for Ollama. The default model is `llama3.2:latest`. Use `/provider model` to list available models and switch between them.

**Tool-capable Ollama models** (recommended for file ops, shell commands, etc.):
- `qwen2.5:7b` / `qwen2.5:14b`
- `llama3.1:8b` / `llama3.1:70b`
- `mistral:7b`

Models without tool support (e.g. `gemma3n`, `deepseek-r1`) will automatically fall back to text-only conversation mode.

### Environment Variables (Alternative)
```bash
# Cloud providers
export OPENAI_API_KEY="your-api-key"
export ANTHROPIC_API_KEY="your-api-key"

# Ollama (optional overrides)
export OLLAMA_MODEL="qwen2.5:latest"
export OLLAMA_BASE_URL="http://localhost:11434"

llm-cli
```

## Documentation

For full documentation, visit: https://github.com/marizmelo/llm-cli

## License

Apache-2.0