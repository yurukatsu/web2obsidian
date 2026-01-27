import type { LLMRequest, LLMResponse } from "../types";
import { buildSystemPrompt, buildUserMessage } from "../prompt-builders";

/**
 * Google Gemini API call
 */
export async function callGemini(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode, signal } = request;
  const geminiSettings = settings.gemini;

  if (!geminiSettings.apiKey) {
    return { success: false, error: "Gemini API key not configured" };
  }

  const modelToUse = model || geminiSettings.defaultModel || "gemini-2.0-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiSettings.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${buildSystemPrompt(prompt)}\n\n${buildUserMessage(content, mode)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 16000,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `Gemini API error: ${response.status} - ${errorText}`,
    };
  }

  const data = await response.json();
  const resultContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!resultContent) {
    return { success: false, error: "No content in Gemini response" };
  }

  return { success: true, content: resultContent };
}
