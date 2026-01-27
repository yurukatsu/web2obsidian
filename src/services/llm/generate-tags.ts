import type { LLMProviderType, LLMSettings } from "../../types/llm";
import type { LLMResponse } from "./types";
import { callLLM } from "./call-llm";

/**
 * Generate tags using LLM
 */
export async function generateTagsWithLLM(
  content: string,
  prompt: string,
  settings: LLMSettings,
  overrideProvider?: LLMProviderType,
  overrideModel?: string,
  signal?: AbortSignal
): Promise<LLMResponse> {
  const provider = overrideProvider || settings.provider;
  const model = overrideModel;

  const tagsPrompt =
    prompt ||
    `Analyze the following content and generate 3-5 relevant tags.
Return ONLY the tags as a comma-separated list, nothing else.
Example output: technology, programming, javascript`;

  return callLLM({
    content,
    prompt: tagsPrompt,
    provider,
    model,
    settings,
    mode: "tags",
    signal,
  });
}
