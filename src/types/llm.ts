// LLM Provider types for Web2Obsidian

export type LLMProviderType =
  | "openai"
  | "azure-openai"
  | "claude"
  | "gemini"
  | "ollama";

export const LLM_PROVIDERS: LLMProviderType[] = [
  "openai",
  "azure-openai",
  "claude",
  "gemini",
  "ollama",
];

// Providers that are still in development (cannot be tested)
export const IN_DEVELOPMENT_PROVIDERS: LLMProviderType[] = ["claude", "gemini"];

// Default OpenAI models
export const DEFAULT_OPENAI_MODELS = ["gpt-4.1", "gpt-5.1", "gpt-5.2"];

// Default Azure OpenAI models (same as OpenAI since Azure hosts OpenAI models)
export const DEFAULT_AZURE_OPENAI_MODELS = ["gpt-4.1", "gpt-5.1", "gpt-5.2"];

// Default Claude models
export const DEFAULT_CLAUDE_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
];

// Default Gemini models
export const DEFAULT_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

// Default Ollama models
export const DEFAULT_OLLAMA_MODELS = ["gpt-oss:20b", "llama3.1"];

// Provider-specific settings
export interface OpenAISettings {
  apiKey: string;
  baseUrl?: string;
  models: string[];
  defaultModel?: string;
}

export interface AzureOpenAISettings {
  apiKey: string;
  endpoint: string;
  apiVersion: string;
  models: string[]; // Deployment names
  defaultModel?: string;
}

export interface ClaudeSettings {
  apiKey: string;
  models: string[];
  defaultModel?: string;
}

export interface GeminiSettings {
  apiKey: string;
  models: string[];
  defaultModel?: string;
}

export interface OllamaSettings {
  endpoint: string;
  models: string[];
  defaultModel?: string;
}

// Combined LLM settings
export interface LLMSettings {
  provider: LLMProviderType;
  openai: OpenAISettings;
  azureOpenai: AzureOpenAISettings;
  claude: ClaudeSettings;
  gemini: GeminiSettings;
  ollama: OllamaSettings;
}

// Default settings
export const createDefaultLLMSettings = (): LLMSettings => ({
  provider: "openai",
  openai: {
    apiKey: "",
    models: [...DEFAULT_OPENAI_MODELS],
    defaultModel: DEFAULT_OPENAI_MODELS[0],
  },
  azureOpenai: {
    apiKey: "",
    endpoint: "",
    apiVersion: "2024-02-15-preview",
    models: [], // User adds their deployment names
    defaultModel: undefined,
  },
  claude: {
    apiKey: "",
    models: [...DEFAULT_CLAUDE_MODELS],
    defaultModel: DEFAULT_CLAUDE_MODELS[0],
  },
  gemini: {
    apiKey: "",
    models: [...DEFAULT_GEMINI_MODELS],
    defaultModel: DEFAULT_GEMINI_MODELS[0],
  },
  ollama: {
    endpoint: "http://localhost:11434",
    models: [...DEFAULT_OLLAMA_MODELS],
    defaultModel: DEFAULT_OLLAMA_MODELS[0],
  },
});

// Helper to get all available models for a provider
export const getAvailableModels = (
  provider: LLMProviderType,
  settings: LLMSettings
): string[] => {
  switch (provider) {
    case "openai":
      return settings.openai.models || [];
    case "azure-openai":
      return settings.azureOpenai.models || [];
    case "claude":
      return settings.claude.models || [];
    case "gemini":
      return settings.gemini.models || [];
    case "ollama":
      return settings.ollama.models || [];
    default:
      return [];
  }
};

// Helper to get the default model for a provider
export const getDefaultModel = (
  provider: LLMProviderType,
  settings: LLMSettings
): string | undefined => {
  switch (provider) {
    case "openai":
      return settings.openai.defaultModel;
    case "azure-openai":
      return settings.azureOpenai.defaultModel;
    case "claude":
      return settings.claude.defaultModel;
    case "gemini":
      return settings.gemini.defaultModel;
    case "ollama":
      return settings.ollama.defaultModel;
    default:
      return undefined;
  }
};
