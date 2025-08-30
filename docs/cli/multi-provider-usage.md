# Using Multiple AI Providers

The Gemini CLI now supports multiple AI providers beyond Google's services. This allows you to use different AI models based on your needs, including local models through Ollama.

## Supported Providers

- **Google** (Gemini, Vertex AI, Code Assist) - Default
- **OpenAI** (GPT-4, GPT-3.5, etc.)
- **Anthropic** (Claude models)
- **Ollama** (Local models like Llama, Mistral, etc.)

## Configuration

### Method 1: Environment Variables

Set the appropriate environment variables for your chosen provider:

```bash
# For OpenAI
export OPENAI_API_KEY="sk-your-openai-key"
export OPENAI_MODEL="gpt-4"

# For Anthropic
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
export ANTHROPIC_MODEL="claude-3-opus-20240229"

# For Ollama (local models)
export OLLAMA_MODEL="llama2"
# OLLAMA_BASE_URL defaults to http://localhost:11434
```

### Method 2: Settings Configuration

You can also configure providers through the settings:

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

## Authentication

When you start the CLI, you'll be prompted to choose your authentication method:

1. **Login with Google** - For Google services
2. **Use Gemini API Key** - For Google Gemini
3. **Vertex AI** - For Google Cloud Vertex AI
4. **Use OpenAI API Key** - For OpenAI services
5. **Use Anthropic API Key** - For Anthropic services
6. **Use Ollama (Local Models)** - For local models

## Usage Examples

### Using OpenAI

```bash
# Set environment variables
export OPENAI_API_KEY="sk-your-key"
export OPENAI_MODEL="gpt-4"

# Start CLI and choose "Use OpenAI API Key"
gemini
```

### Using Ollama

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

## Switching Between Providers

You can switch between providers by:

1. Changing environment variables and restarting the CLI
2. Updating the settings configuration
3. Using the authentication dialog to select a different provider

## Provider-Specific Features

### Google Services
- Full integration with Google Cloud
- Code Assist features
- Vertex AI enterprise features

### OpenAI
- GPT-4 and GPT-3.5 models
- Function calling support
- Streaming responses

### Anthropic
- Claude models
- Constitutional AI principles
- Long context windows

### Ollama
- Local model inference
- No API costs
- Privacy-focused
- Custom model support

## Troubleshooting

### Ollama Issues
- Ensure Ollama is running: `ollama serve`
- Check model availability: `ollama list`
- Verify connection: `curl http://localhost:11434/api/tags`

### API Key Issues
- Verify API keys are correctly set
- Check provider-specific rate limits
- Ensure proper permissions for API keys

### Model Compatibility
- Some features may not be available across all providers
- Token limits vary between models
- Function calling support varies by provider
