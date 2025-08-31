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
- 🔧 Interactive CLI interface
- 📁 Context-aware file processing
- 🔌 Extensible with custom commands
- 🎯 Provider-specific model switching
- 💾 Memory and context management

## Provider Setup

### Ollama (Local)
```bash
# Install Ollama first, then:
llm-cli /provider switch ollama
```

### OpenAI
```bash
export OPENAI_API_KEY="your-api-key"
llm-cli /provider switch openai
```

### Anthropic Claude
```bash
export ANTHROPIC_API_KEY="your-api-key"
llm-cli /provider switch anthropic
```

## Documentation

For full documentation, visit: https://github.com/marizmelo/llm-cli

## License

Apache-2.0