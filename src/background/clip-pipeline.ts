import type { PageInfo, YouTubeInfo } from "../content/index";
import type { Template, TemplateSettings } from "../types/template";
import type { LLMSettings, LLMProviderType } from "../types/llm";
import type { ClipTask, TaskPageInfo } from "../types/task";
import { createDefaultTemplateSettings } from "../types/template";
import { createDefaultLLMSettings } from "../types/llm";
import { generateTaskId } from "../types/task";
import {
  isYouTubeVideo,
  processTemplate,
  getDomain,
  replaceTemplateVariables,
  type TemplateContext,
  type CustomVariable,
} from "../utils/index";
import { formatContentWithLLM, generateTagsWithLLM } from "../services/llm";
import {
  saveToObsidian,
  saveToObsidianViaUri,
  createDefaultObsidianApiSettings,
  type ObsidianApiSettings,
} from "../services/obsidian-api";
import {
  upsertTask,
  updateTaskStep,
  completeTask,
  failTask,
  setAbortController,
  deleteAbortController,
} from "./task-manager";
import { getLocalizedMessage } from "./i18n";
import { showNotification } from "./notifications";

/**
 * Start a new clip task - extracts page info and starts background processing
 */
export async function startClipTask(templateId?: string): Promise<string> {
  const tab = await getActiveTab();

  if (!tab.url) {
    throw new Error("No URL found for active tab");
  }

  // Get settings first to validate
  const syncSettings = await chrome.storage.sync.get([
    "vaultName",
    "obsidianApiSettings",
  ]);
  // Load templateSettings from local storage (large data)
  const localSettings = await chrome.storage.local.get(["templateSettings"]);
  const settings = { ...syncSettings, ...localSettings };

  const vaultName = settings.vaultName;
  if (!vaultName) {
    throw new Error("Vault name not configured. Please set it in settings.");
  }

  const obsidianApiSettings: ObsidianApiSettings =
    settings.obsidianApiSettings || createDefaultObsidianApiSettings();

  // Only require API key if Local REST API is enabled
  if (obsidianApiSettings.enabled && !obsidianApiSettings.apiKey) {
    throw new Error(
      "Obsidian API key not configured. Please set it in settings."
    );
  }

  const templateSettings: TemplateSettings =
    settings.templateSettings || createDefaultTemplateSettings();
  const isYouTube = isYouTubeVideo(tab.url);

  // Find the appropriate template set
  const defaultSet = templateSettings.sets.find(
    (s) => s.id === templateSettings.defaultSetId
  );
  let templateSet = defaultSet || templateSettings.sets[0];
  if (templateId) {
    const requestedSet = templateSettings.sets.find((s) => s.id === templateId);
    if (requestedSet) {
      templateSet = requestedSet;
    }
  }

  // Get the appropriate template from the set based on page type
  const template: Template = isYouTube
    ? templateSet.youtubeTemplate
    : templateSet.webTemplate;
  if (!template) {
    throw new Error(
      "No template found. Please configure templates in settings."
    );
  }

  // Extract page info immediately while we have access to the tab
  const pageInfo = await getPageInfoFromActiveTab();

  // Create task
  const taskId = generateTaskId();
  const taskPageInfo: TaskPageInfo = {
    title: pageInfo.title,
    url: pageInfo.url,
    domain: getDomain(pageInfo.url),
    isYouTube,
  };

  const task: ClipTask = {
    id: taskId,
    status: "running",
    step: "extracting",
    pageInfo: taskPageInfo,
    templateName: template.name,
    createdAt: Date.now(),
    llmEnabled: {
      content: template.useLLM && template.llmGenerateContent,
      tags: template.useLLM && template.llmGenerateTags,
    },
  };

  // Save task and start processing in background
  await upsertTask(task);

  // Run the actual clip process in the background (don't await)
  runClipTask(taskId, pageInfo, template, isYouTube, tab.id).catch((error) => {
    console.error("[Web2Obsidian] Clip task failed:", taskId, error);
  });

  return taskId;
}

/**
 * Run the clip task in the background
 */
async function runClipTask(
  taskId: string,
  pageInfo: PageInfo | YouTubeInfo,
  template: Template,
  isYouTube: boolean,
  _originalTabId?: number
): Promise<void> {
  const abortController = new AbortController();
  setAbortController(taskId, abortController);
  const { signal } = abortController;

  try {
    // Get remaining settings
    const settings = await chrome.storage.sync.get([
      "vaultName",
      "customVariables",
      "llmSettings",
      "obsidianApiSettings",
    ]);

    const customVariables: CustomVariable[] = settings.customVariables || [];
    const llmSettings: LLMSettings =
      settings.llmSettings || createDefaultLLMSettings();
    const obsidianApiSettings: ObsidianApiSettings =
      settings.obsidianApiSettings || createDefaultObsidianApiSettings();

    // Build template context
    let context: TemplateContext = buildTemplateContext(pageInfo, isYouTube);

    // Track if LLM content generation was successful
    let llmContentOutput: string | null = null;

    // LLM content processing
    if (template.useLLM && template.llmGenerateContent) {
      if (signal.aborted) return;
      await updateTaskStep(taskId, "llm_content");
      console.log("[Web2Obsidian] LLM content formatting enabled");
      const provider =
        (template.llmProvider as LLMProviderType) || llmSettings.provider;
      const model = template.llmModel;

      // Resolve template variables in the prompt (e.g., {{transcript}})
      const resolvedPrompt = replaceTemplateVariables(
        template.llmPrompt,
        context
      );

      const llmResult = await formatContentWithLLM(
        context.content || "",
        resolvedPrompt,
        llmSettings,
        provider,
        model,
        signal
      );

      if (llmResult.success && llmResult.content) {
        console.log("[Web2Obsidian] LLM content formatting successful");
        // Store LLM output directly (will bypass template content)
        llmContentOutput = llmResult.content;
        // Also update context for tag generation
        context = { ...context, content: llmResult.content };
      } else {
        console.warn(
          "[Web2Obsidian] LLM content formatting failed:",
          llmResult.error
        );
      }
    }

    // LLM tag generation
    if (template.useLLM && template.llmGenerateTags) {
      if (signal.aborted) return;
      await updateTaskStep(taskId, "llm_tags");
      console.log("[Web2Obsidian] LLM tag generation enabled");
      const provider =
        (template.llmProvider as LLMProviderType) || llmSettings.provider;
      const model = template.llmModel;

      // Resolve template variables in the tags prompt
      const resolvedTagsPrompt = replaceTemplateVariables(
        template.llmTagsPrompt,
        context
      );

      const tagsResult = await generateTagsWithLLM(
        context.content || "",
        resolvedTagsPrompt,
        llmSettings,
        provider,
        model,
        signal
      );

      if (tagsResult.success && tagsResult.content) {
        console.log(
          "[Web2Obsidian] LLM tag generation successful:",
          tagsResult.content
        );
        const generatedTags = tagsResult.content.trim();

        customVariables.push({
          name: "llmTags",
          value: generatedTags,
        });

        // Merge with existing tags
        const tagsProperty = template.properties.find(
          (p) => p.key === "tags" && p.inputType === "tags"
        );
        if (tagsProperty) {
          let existingTags: string[] = [];
          try {
            const existingValue = tagsProperty.value.trim();
            if (existingValue && existingValue !== "[]") {
              existingTags = JSON.parse(existingValue);
            }
          } catch {
            // If parsing fails, treat as empty
          }

          let newTags: string[] = [];
          try {
            newTags = JSON.parse(generatedTags);
          } catch {
            newTags = [generatedTags];
          }

          const mergedTags = [...new Set([...existingTags, ...newTags])];
          tagsProperty.value = JSON.stringify(mergedTags);
        }
      } else {
        console.warn(
          "[Web2Obsidian] LLM tag generation failed:",
          tagsResult.error
        );
      }
    }

    // Process template
    // If LLM content generation was successful, use LLM output directly (bypass template content)
    const contentToUse =
      llmContentOutput !== null ? llmContentOutput : template.content;
    const processedNote = processTemplate({
      folder: template.folder,
      filename: template.filename,
      properties: template.properties,
      content: contentToUse,
      context,
      customVariables,
    });

    // Save to Obsidian
    if (signal.aborted) return;
    await updateTaskStep(taskId, "saving");

    const vaultName: string = settings.vaultName || "";
    let saveResult: { success: boolean; error?: string; path?: string };
    let savedViaUri = false;

    if (obsidianApiSettings.enabled) {
      // Try REST API first
      console.log("[Web2Obsidian] Saving note via Local REST API...");
      saveResult = await saveToObsidian({
        folder: processedNote.folder,
        filename: processedNote.filename,
        content: processedNote.content,
        settings: obsidianApiSettings,
      });

      // Fallback to URI if REST API fails
      if (!saveResult.success) {
        console.warn(
          "[Web2Obsidian] REST API failed, falling back to URI:",
          saveResult.error
        );
        saveResult = await saveToObsidianViaUri({
          vaultName,
          folder: processedNote.folder,
          filename: processedNote.filename,
          content: processedNote.content,
        });
        savedViaUri = true;
      }
    } else {
      // REST API disabled — use URI directly
      console.log("[Web2Obsidian] Saving note via obsidian:// URI...");
      saveResult = await saveToObsidianViaUri({
        vaultName,
        folder: processedNote.folder,
        filename: processedNote.filename,
        content: processedNote.content,
      });
      savedViaUri = true;
    }

    if (!saveResult.success) {
      throw new Error(saveResult.error || "Failed to save to Obsidian");
    }

    // Mark task as completed
    await completeTask(taskId, { path: saveResult.path || "" });
    console.log("[Web2Obsidian] Task completed:", taskId, saveResult.path);

    // Show success notification
    const successMsgKey = savedViaUri ? "toast.savedViaUri" : "toast.success";
    const successMsg = await getLocalizedMessage(successMsgKey);
    await showNotification(taskId, successMsg, "success");
  } catch (error) {
    // Ignore errors from aborted tasks — cancelTask() already updated the status
    if (signal.aborted) return;

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await failTask(taskId, errorMessage);
    console.error("[Web2Obsidian] Task failed:", taskId, errorMessage);

    // Show error notification
    const errorMsg = await getLocalizedMessage("toast.error", {
      error: errorMessage,
    });
    await showNotification(taskId, errorMsg, "error");
  } finally {
    deleteAbortController(taskId);
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.id) {
    throw new Error("No active tab found");
  }

  return tab;
}

export async function getPageInfoFromActiveTab(): Promise<
  PageInfo | YouTubeInfo
> {
  const tab = await getActiveTab();

  if (!tab.id) {
    throw new Error("No active tab found");
  }

  const isYouTube = tab.url ? isYouTubeVideo(tab.url) : false;
  const messageType = isYouTube ? "GET_YOUTUBE_INFO" : "GET_PAGE_INFO";

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id!, { type: messageType }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.success) {
        reject(new Error(response?.error || "Failed to get page info"));
        return;
      }

      resolve(response.data);
    });
  });
}

function buildTemplateContext(
  pageInfo: PageInfo | YouTubeInfo,
  isYouTube: boolean
): TemplateContext {
  const now = new Date();

  if (isYouTube && "videoId" in pageInfo) {
    const ytInfo = pageInfo as YouTubeInfo;
    console.log("[Web2Obsidian] YouTube info received:", {
      title: ytInfo.title,
      videoId: ytInfo.videoId,
      transcriptLength: ytInfo.transcript?.length || 0,
      descriptionLength: ytInfo.description?.length || 0,
    });
    return {
      title: ytInfo.title,
      url: ytInfo.url,
      description: ytInfo.description,
      author: ytInfo.channel,
      published: ytInfo.published,
      content: ytInfo.transcript || ytInfo.description,
      transcript: ytInfo.transcript || "",
      videoId: ytInfo.videoId,
      channel: ytInfo.channel,
      duration: ytInfo.duration,
      date: now,
    };
  }

  const webInfo = pageInfo as PageInfo;

  // Use pre-converted markdown from content script
  // If there's a selection, prefer the selection markdown, otherwise use page content markdown
  const contentMarkdown = webInfo.selectionMarkdown
    ? webInfo.selectionMarkdown
    : webInfo.contentMarkdown || webInfo.content;

  const selectionMarkdown = webInfo.selectionMarkdown || webInfo.selection;

  return {
    title: webInfo.title,
    url: webInfo.url,
    description: webInfo.description,
    author: webInfo.author,
    published: webInfo.published,
    selection: selectionMarkdown,
    content: contentMarkdown,
    date: now,
  };
}
