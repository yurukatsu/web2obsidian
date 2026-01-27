import type { LLMRequest, LLMResponse } from "../types";
import { buildSystemPrompt, buildUserMessage } from "../prompt-builders";

/**
 * OpenAI API call
 */
export async function callOpenAI(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode, signal } = request;
  const openaiSettings = settings.openai;

  if (!openaiSettings.apiKey) {
    return { success: false, error: "OpenAI API key not configured" };
  }

  const modelToUse = model || openaiSettings.defaultModel || "gpt-4.1";
  const baseUrl = openaiSettings.baseUrl || "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: [
        { role: "system", content: buildSystemPrompt(prompt) },
        { role: "user", content: buildUserMessage(content, mode) },
      ],
      temperature: 0.3,
      max_completion_tokens: 16000,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `OpenAI API error: ${response.status} - ${errorText}`,
    };
  }

  const data = await response.json();
  const resultContent = data.choices?.[0]?.message?.content;

  if (!resultContent) {
    return { success: false, error: "No content in OpenAI response" };
  }

  return { success: true, content: resultContent };
}
