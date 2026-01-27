import type { LLMRequest, LLMResponse } from "../types";
import { buildSystemPrompt, buildUserMessage } from "../prompt-builders";

/**
 * Ollama API call (local)
 */
export async function callOllama(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode, signal } = request;
  const ollamaSettings = settings.ollama;

  const endpoint = ollamaSettings.endpoint || "http://localhost:11434";
  const modelToUse = model || ollamaSettings.defaultModel || "llama3.1";

  const response = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: [
        { role: "system", content: buildSystemPrompt(prompt) },
        { role: "user", content: buildUserMessage(content, mode) },
      ],
      stream: false,
      options: {
        temperature: 0.3,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `Ollama API error: ${response.status} - ${errorText}`,
    };
  }

  const data = await response.json();
  const resultContent = data.message?.content;

  if (!resultContent) {
    return { success: false, error: "No content in Ollama response" };
  }

  return { success: true, content: resultContent };
}
