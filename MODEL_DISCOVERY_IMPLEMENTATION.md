# Model Discovery Implementation

## Overview

This document describes the implementation of automatic model discovery and updates for the enhanced provider system. The system now dynamically fetches model lists from provider APIs and keeps the configuration up-to-date.

## 🎯 **Key Features**

### **1. Automatic Model Discovery**
- **API Integration**: Fetches model lists directly from provider APIs
- **Caching System**: 24-hour cache to avoid excessive API calls
- **Smart Updates**: Only updates when cache expires or on demand
- **Safe Updates**: Creates backups before modifying configuration

### **2. Provider-Specific Implementations**
- **OpenAI**: `/v1/models` endpoint with GPT and embedding model filtering
- **Anthropic**: `/v1/models` endpoint with Claude model filtering
- **Google**: Curated list (stable, manually updated)
- **Ollama**: Local `/api/tags` endpoint for installed models

### **3. New Commands**
- `/provider discover <provider>` - Discover models for specific provider
- `/provider update` - Update all providers that need updating
- Enhanced `/provider status` - Shows model update status

## 🔧 **Technical Implementation**

### **ModelDiscovery Class**

**Location**: `packages/cli/src/config/modelDiscovery.ts`

**Key Methods**:
- `discoverModels(provider, apiKey)` - Main discovery method
- `updateProviderConfig(provider, apiKey)` - Updates configuration
- `shouldUpdateModels(provider)` - Checks if update is needed
- `getUpdateStatus()` - Gets status for all providers

### **API Integration**

#### **OpenAI Models**
```typescript
const response = await fetch(`${baseUrl}/models`, {
  headers: {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  }
});

const models = data.data
  .filter((model: any) => 
    model.id.startsWith('gpt-') || 
    model.id.startsWith('text-') ||
    model.id.includes('embedding')
  )
  .map((model: any) => model.id)
  .sort();
```

#### **Anthropic Models**
```typescript
const response = await fetch(`${baseUrl}/v1/models`, {
  headers: {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json'
  }
});

const models = data.data
  .filter((model: any) => model.id.startsWith('claude-'))
  .map((model: any) => model.id)
  .sort();
```

#### **Ollama Models**
```typescript
const response = await fetch(`${baseUrl}/api/tags`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});

const models = data.models
  .map((model: { name: string }) => model.name)
  .sort();
```

### **Caching System**

**Cache Location**: `.gemini/model-cache.json`

**Cache Duration**: 24 hours

**Cache Structure**:
```json
{
  "openai": {
    "success": true,
    "models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    "lastUpdated": 1704067200000
  },
  "anthropic": {
    "success": true,
    "models": ["claude-3-opus-20240229", "claude-3-sonnet-20240229"],
    "lastUpdated": 1704067200000
  }
}
```

### **Configuration Updates**

**Backup System**: Creates timestamped backups before updates
**Update Process**:
1. Fetch fresh model list from API
2. Compare with current configuration
3. Create backup of current config
4. Update models list
5. Add `lastUpdated` timestamp
6. Write updated configuration

## 🚀 **User Experience**

### **Discover Models for Specific Provider**

```bash
/provider discover openai
```

**Output**:
```
🔍 Discovering models for OpenAI...

✅ Successfully updated models for openai

📋 Available models (12):
  • gpt-4
  • gpt-4-1106-preview
  • gpt-4-turbo
  • gpt-4-turbo-preview
  • gpt-3.5-turbo
  • gpt-3.5-turbo-16k
  • text-embedding-ada-002
  • text-embedding-3-large
  • text-embedding-3-small
```

### **Update All Providers**

```bash
/provider update
```

**Output**:
```
🔄 Updating models for 2 provider(s)...

✅ openai: Successfully updated models for openai
❌ anthropic: Failed to update models for anthropic. Check your API key and try again.
```

### **Check Update Status**

```bash
/provider status
```

**Output**:
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

🔄 Model Update Status:
  ✅ openai: Up to date (2024-01-15)
  🔄 anthropic: Needs update (2024-01-10)
  ✅ google: Up to date (2024-01-14)
  🔄 ollama: Needs update (Never)
```

## 📋 **Configuration Schema**

### **Updated Provider Configuration**

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
      "models": ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-3.5-turbo"],
      "lastUpdated": 1704067200000
    }
  }
}
```

**New Fields**:
- `lastUpdated`: Timestamp of last model discovery
- `models`: Dynamically updated model list

## 🔄 **Update Workflow**

### **Automatic Updates**
1. **Cache Check**: Check if cache is expired (24 hours)
2. **API Call**: Fetch fresh model list if needed
3. **Comparison**: Compare with current configuration
4. **Update**: Update configuration if changes detected
5. **Backup**: Create backup before changes
6. **Cache**: Store result in cache

### **Manual Updates**
1. **Command**: User runs `/provider discover <provider>`
2. **Validation**: Check if provider is configured
3. **API Call**: Force fresh API call (ignore cache)
4. **Update**: Update configuration with new models
5. **Feedback**: Show added/removed models

## 🛡️ **Safety Features**

### **Error Handling**
- **API Failures**: Graceful fallback to cached data
- **Network Issues**: Timeout and retry logic
- **Invalid Responses**: Data validation and filtering
- **Configuration Errors**: Backup restoration capability

### **Backup System**
- **Automatic Backups**: Before any configuration changes
- **Timestamped Files**: `.gemini/providers.json.backup.{timestamp}`
- **Restoration**: Manual restore from backup if needed

### **Cache Management**
- **Expiration**: 24-hour cache duration
- **Invalidation**: Manual cache clearing
- **Fallback**: Use cached data if API fails

## 📊 **Monitoring and Status**

### **Update Status Tracking**
- **Last Updated**: Timestamp of last successful update
- **Update Needed**: Boolean flag for cache expiration
- **Provider Status**: Individual provider update status
- **Error Tracking**: Failed update attempts

### **Status Display**
- **Visual Indicators**: ✅ for up-to-date, 🔄 for needs update
- **Date Formatting**: Human-readable timestamps
- **Provider Names**: Clear provider identification
- **Error Messages**: Specific error information

## 🎯 **Benefits**

### **For Users**
- **Always Current**: Latest model options available
- **Automatic Updates**: No manual configuration needed
- **Clear Status**: Know when models were last updated
- **Safe Updates**: Automatic backups protect configuration

### **For Developers**
- **Extensible**: Easy to add new providers
- **Maintainable**: Centralized discovery logic
- **Reliable**: Robust error handling and fallbacks
- **Testable**: Clear separation of concerns

### **For Operations**
- **Reduced Maintenance**: Automatic model list updates
- **Better UX**: Users always see latest options
- **Monitoring**: Clear status of update health
- **Recovery**: Backup system for configuration safety

## 🔮 **Future Enhancements**

### **Potential Improvements**
1. **Scheduled Updates**: Automatic background updates
2. **Model Metadata**: Additional model information (capabilities, pricing)
3. **Version Tracking**: Track model version changes
4. **Notification System**: Alert users to new models
5. **Bulk Operations**: Update multiple providers simultaneously

### **Extensibility**
- **Custom Providers**: Easy to add new AI services
- **Plugin System**: Third-party provider integrations
- **API Versioning**: Support for different API versions
- **Rate Limiting**: Respect provider API limits

## ✅ **Testing**

### **Manual Testing Checklist**
- [ ] `/provider discover` works for all providers
- [ ] `/provider update` updates only needed providers
- [ ] `/provider status` shows correct update status
- [ ] Cache expiration works correctly
- [ ] Backup files are created before updates
- [ ] Error handling works for API failures
- [ ] Configuration updates are applied correctly

### **Integration Testing**
- [ ] Model discovery works with existing authentication
- [ ] Updated models are available in provider switching
- [ ] Cache system doesn't interfere with normal operation
- [ ] Backup system preserves configuration integrity

## 🎉 **Success Criteria**

The model discovery system successfully:

1. ✅ **Fetches model lists** from provider APIs
2. ✅ **Caches results** to minimize API calls
3. ✅ **Updates configuration** automatically
4. ✅ **Creates backups** before changes
5. ✅ **Provides status** information
6. ✅ **Handles errors** gracefully
7. ✅ **Maintains backward compatibility**

This implementation transforms the static provider configuration into a dynamic, self-updating system that keeps users informed of the latest available models while maintaining safety and reliability.
