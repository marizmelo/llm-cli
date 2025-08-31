# LLM CLI

Multi-provider AI assistant for the command line supporting OpenAI, Anthropic Claude, Ollama, and more.

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