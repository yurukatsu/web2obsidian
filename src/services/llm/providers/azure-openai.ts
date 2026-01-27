import type { LLMRequest, LLMResponse } from "../types";
import { buildSystemPrompt, buildUserMessage } from "../prompt-builders";

/**
 * Azure OpenAI API call
 */
export async function callAzureOpenAI(
  request: LLMRequest
): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode, signal } = request;
  const azureSettings = settings.azureOpenai;

  if (!azureSettings.apiKey) {
    return { success: false, error: "Azure OpenAI API key not configured" };
  }

  if (!azureSettings.endpoint) {
    return { success: false, error: "Azure OpenAI endpoint not configured" };
  }

  const deploymentName = model || azureSettings.defaultModel;
  if (!deploymentName) {
    return {
      success: false,
      error: "Azure OpenAI deployment name not configured",
    };
  }

  const url = `${azureSettings.endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${azureSettings.apiVersion}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": azureSettings.apiKey,
    },
    body: JSON.stringify({
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
      error: `Azure OpenAI API error: ${response.status} - ${errorText}`,
    };
  }

  const data = await response.json();
  const resultContent = data.choices?.[0]?.message?.content;

  if (!resultContent) {
    return { success: false, error: "No content in Azure OpenAI response" };
  }

  return { success: true, content: resultContent };
}
