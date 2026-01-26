// LLM Service for Web2Obsidian
// Handles API calls to different LLM providers

import type { LLMSettings, LLMProviderType } from "../types/llm";

export interface LLMRequest {
  content: string;
  prompt: string;
  provider: LLMProviderType;
  model?: string;
  settings: LLMSettings;
  mode?: "format" | "tags"; // Operation mode to determine user message
}

export interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
}

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

/**
 * Build the system prompt for content formatting
 */
function buildSystemPrompt(userPrompt: string): string {
  const defaultPrompt = `You are a helpful assistant that cleans and formats web content for note-taking.
Your task is to:
1. Remove any remaining noise (navigation elements, ads, related articles, author bios, etc.)
2. Clean up formatting issues
3. Preserve the main article content and structure
4. Keep headings, lists, code blocks, and links intact
5. Output clean Markdown

Return ONLY the cleaned content, no explanations or additional text.`;

  return userPrompt || defaultPrompt;
}

/**
 * Build the user message based on operation mode
 */
function buildUserMessage(content: string, mode?: "format" | "tags"): string {
  if (mode === "tags") {
    return `Please analyze the following content and generate tags:\n\n${content}`;
  }
  return `Please process the following content:\n\n${content}`;
}

/**
 * OpenAI API call
 */
async function callOpenAI(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode } = request;
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

/**
 * Azure OpenAI API call
 */
async function callAzureOpenAI(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode } = request;
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

/**
 * Anthropic Claude API call
 */
async function callClaude(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode } = request;
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

/**
 * Google Gemini API call
 */
async function callGemini(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode } = request;
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

/**
 * Ollama API call (local)
 */
async function callOllama(request: LLMRequest): Promise<LLMResponse> {
  const { content, prompt, model, settings, mode } = request;
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

/**
 * Format content using LLM
 * This is the main entry point for content formatting
 */
export async function formatContentWithLLM(
  content: string,
  prompt: string,
  settings: LLMSettings,
  overrideProvider?: LLMProviderType,
  overrideModel?: string
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
  });
}

/**
 * Generate tags using LLM
 */
export async function generateTagsWithLLM(
  content: string,
  prompt: string,
  settings: LLMSettings,
  overrideProvider?: LLMProviderType,
  overrideModel?: string
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
  });
}
