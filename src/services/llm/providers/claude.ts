import type { LLMRequest, LLMResponse } from "../types";
import { buildSystemPrompt, buildUserMessage } from "../prompt-builders";

/**
 * Anthropic Claude API call
 */
export async function callClaude(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode, signal } = request;
  const claudeSettings = settings.claude;

  if (!claudeSettings.apiKey) {
    return { success: false, error: "Claude API key not configured" };
  }

  const modelToUse =
    model || claudeSettings.defaultModel || "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeSettings.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelToUse,
      max_tokens: 16000,
      system: buildSystemPrompt(prompt),
      messages: [{ role: "user", content: buildUserMessage(content, mode) }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `Claude API error: ${response.status} - ${errorText}`,
    };
  }

  const data = await response.json();
  const resultContent = data.content?.[0]?.text;

  if (!resultContent) {
    return { success: false, error: "No content in Claude response" };
  }

  return { success: true, content: resultContent };
}
