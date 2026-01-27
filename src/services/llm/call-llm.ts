import type { LLMRequest, LLMResponse } from "./types";
import { callOpenAI } from "./providers/openai";
import { callAzureOpenAI } from "./providers/azure-openai";
import { callClaude } from "./providers/claude";
import { callGemini } from "./providers/gemini";
import { callOllama } from "./providers/ollama";

/**
 * Call the appropriate LLM provider based on settings
 */
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const { provider } = request;

  try {
    switch (provider) {
      case "openai":
        return await callOpenAI(request);
      case "azure-openai":
        return await callAzureOpenAI(request);
      case "claude":
        return await callClaude(request);
      case "gemini":
        return await callGemini(request);
      case "ollama":
        return await callOllama(request);
      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (error) {
    console.error("[Web2Obsidian] LLM call failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
