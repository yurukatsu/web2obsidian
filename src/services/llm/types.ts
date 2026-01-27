import type { LLMSettings, LLMProviderType } from "../../types/llm";

export interface LLMRequest {
  content: string;
  prompt: string;
  provider: LLMProviderType;
  model?: string;
  settings: LLMSettings;
  mode?: "format" | "tags"; // Operation mode to determine user message
  signal?: AbortSignal;
}

export interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
}
