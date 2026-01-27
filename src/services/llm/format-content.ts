import type { LLMProviderType, LLMSettings } from "../../types/llm";
import type { LLMResponse } from "./types";
import { callLLM } from "./call-llm";

/**
 * Format content using LLM
 * This is the main entry point for content formatting
 */
export async function formatContentWithLLM(
  content: string,
  prompt: string,
  settings: LLMSettings,
  overrideProvider?: LLMProviderType,
  overrideModel?: string,
  signal?: AbortSignal
): Promise<LLMResponse> {
  const provider = overrideProvider || settings.provider;
  const model = overrideModel;

  return callLLM({
    content,
    prompt,
    provider,
    model,
    settings,
    mode: "format",
    signal,
  });
}
