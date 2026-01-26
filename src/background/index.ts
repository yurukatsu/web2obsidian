// Background service worker for Web2Obsidian extension

import type { PageInfo, YouTubeInfo } from "../content/index";
import type { Template, TemplateSettings } from "../types/template";
import type { LLMSettings, LLMProviderType } from "../types/llm";
import type {
  ClipTask,
  TaskHistory,
  TaskStep,
  TaskPageInfo,
} from "../types/task";
import { createDefaultTemplateSettings } from "../types/template";
import { createDefaultLLMSettings } from "../types/llm";
import { createDefaultTaskHistory, generateTaskId } from "../types/task";
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
  testObsidianConnection,
  openObsidianVaultFromServiceWorker,
  type ObsidianApiSettings,
  createDefaultObsidianApiSettings,
} from "../services/obsidian-api";

import enLocale from "../i18n/locales/en.json";
import jaLocale from "../i18n/locales/ja.json";

// Simple i18n helper for background script
type Locale = typeof enLocale;
const locales: Record<string, Locale> = {
  en: enLocale,
  ja: jaLocale,
};

async function getLocalizedMessage(
  key: string,
  params?: Record<string, string>
): Promise<string> {
  const { language } = await chrome.storage.sync.get(["language"]);
  const lang = language || "en";
  const locale = locales[lang] || locales.en;

  // Navigate to nested key (e.g., "toast.success")
  const keys = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = locale;
  for (const k of keys) {
    value = value?.[k];
  }

  let message = typeof value === "string" ? value : key;

  // Replace {{param}} placeholders
  if (params) {
    for (const [param, replacement] of Object.entries(params)) {
      message = message.replace(
        new RegExp(`\\{\\{${param}\\}\\}`, "g"),
        replacement
      );
    }
  }

  return message;
}

// ============================================================================
// Task Management
// ============================================================================

/**
 * Get task history from storage
 */
async function getTaskHistory(): Promise<TaskHistory> {
  const { taskHistory } = await chrome.storage.local.get(["taskHistory"]);
  return taskHistory || createDefaultTaskHistory();
}

/**
 * Save task history to storage
 */
async function saveTaskHistory(history: TaskHistory): Promise<void> {
  await chrome.storage.local.set({ taskHistory: history });
}

/**
 * Add or update a task in history
 */
async function upsertTask(task: ClipTask): Promise<void> {
  const history = await getTaskHistory();
  const existingIndex = history.tasks.findIndex((t) => t.id === task.id);

  if (existingIndex >= 0) {
    history.tasks[existingIndex] = task;
  } else {
    // Add new task at the beginning
    history.tasks.unshift(task);
    // Keep only maxTasks
    if (history.tasks.length > history.maxTasks) {
      history.tasks = history.tasks.slice(0, history.maxTasks);
    }
  }

  await saveTaskHistory(history);
  // Broadcast update to popup
  broadcastTaskUpdate(task);
}

/**
 * Broadcast task update to all extension pages
 */
function broadcastTaskUpdate(task: ClipTask): void {
  chrome.runtime
    .sendMessage({
      type: "TASK_UPDATE",
      task,
    })
    .catch(() => {
      // Popup might be closed, ignore the error
    });
}

/**
 * Update task step and broadcast
 */
async function updateTaskStep(taskId: string, step: TaskStep): Promise<void> {
  const history = await getTaskHistory();
  const task = history.tasks.find((t) => t.id === taskId);
  if (task) {
    task.step = step;
    await saveTaskHistory(history);
    broadcastTaskUpdate(task);
  }
}

/**
 * Mark task as completed
 */
async function completeTask(
  taskId: string,
  result: { path: string }
): Promise<void> {
  const history = await getTaskHistory();
  const task = history.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "success";
    task.step = "done";
    task.completedAt = Date.now();
    task.result = result;
    await saveTaskHistory(history);
    broadcastTaskUpdate(task);
  }
}

/**
 * Mark task as failed
 */
async function failTask(taskId: string, error: string): Promise<void> {
  const history = await getTaskHistory();
  const task = history.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "error";
    task.completedAt = Date.now();
    task.error = error;
    await saveTaskHistory(history);
    broadcastTaskUpdate(task);
  }
}

// ============================================================================
// Extension Initialization
// ============================================================================

// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Web2Obsidian extension installed");

  try {
    // Initialize default template settings if not exists (using local storage for large data)
    const localSettings = await chrome.storage.local.get(["templateSettings"]);
    if (!localSettings.templateSettings) {
      // Check if templateSettings exists in sync storage (migration from old location)
      const syncSettings = await chrome.storage.sync.get(["templateSettings"]);
      if (syncSettings.templateSettings) {
        // Migrate from sync to local storage
        console.log(
          "Web2Obsidian: Migrating templateSettings from sync to local storage"
        );
        await chrome.storage.local.set({
          templateSettings: syncSettings.templateSettings,
        });
        await chrome.storage.sync.remove(["templateSettings"]);
      } else {
        // Create new default settings
        const defaultSettings = createDefaultTemplateSettings();
        await chrome.storage.local.set({ templateSettings: defaultSettings });
        console.log("Web2Obsidian: Initialized default template settings");
      }
    }

    // Create context menus
    await createContextMenus();
  } catch (error) {
    console.error("Web2Obsidian: Failed to initialize settings:", error);
  }
});

// ============================================================================
// Context Menu
// ============================================================================

/**
 * Create context menu items with template sets
 */
async function createContextMenus(): Promise<void> {
  // Remove existing menus first
  await chrome.contextMenus.removeAll();

  // Load template sets
  const localSettings = await chrome.storage.local.get(["templateSettings"]);
  const templateSettings: TemplateSettings =
    localSettings.templateSettings || createDefaultTemplateSettings();
  const templateSets = templateSettings.sets || [];

  const clipPageTitle = await getLocalizedMessage("contextMenu.clipPage");
  const clipSelectionTitle = await getLocalizedMessage(
    "contextMenu.clipSelection"
  );

  if (templateSets.length <= 1) {
    // Single template set - simple menu
    chrome.contextMenus.create({
      id: "clip-page",
      title: clipPageTitle,
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });

    chrome.contextMenus.create({
      id: "clip-selection",
      title: clipSelectionTitle,
      contexts: ["selection"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
  } else {
    // Multiple template sets - create parent menu with submenu items

    // Parent menu for page context
    chrome.contextMenus.create({
      id: "clip-page-parent",
      title: clipPageTitle,
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });

    // Add template set items under page parent
    for (const set of templateSets) {
      const isDefault = set.id === templateSettings.defaultSetId;
      chrome.contextMenus.create({
        id: `clip-page-${set.id}`,
        parentId: "clip-page-parent",
        title: isDefault ? `${set.name} ✓` : set.name,
        contexts: ["page"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });
    }

    // Parent menu for selection context
    chrome.contextMenus.create({
      id: "clip-selection-parent",
      title: clipSelectionTitle,
      contexts: ["selection"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });

    // Add template set items under selection parent
    for (const set of templateSets) {
      const isDefault = set.id === templateSettings.defaultSetId;
      chrome.contextMenus.create({
        id: `clip-selection-${set.id}`,
        parentId: "clip-selection-parent",
        title: isDefault ? `${set.name} ✓` : set.name,
        contexts: ["selection"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });
    }
  }
}

/**
 * Check if Obsidian is connected
 */
async function checkObsidianConnection(): Promise<boolean> {
  try {
    const settings = await chrome.storage.sync.get(["obsidianApiSettings"]);
    const obsidianApiSettings: ObsidianApiSettings =
      settings.obsidianApiSettings || createDefaultObsidianApiSettings();

    if (!obsidianApiSettings.apiKey) {
      return false;
    }

    const result = await testObsidianConnection(obsidianApiSettings);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Show confirmation dialog in the page asking to open Obsidian
 */
async function showOpenObsidianConfirmation(tabId: number): Promise<boolean> {
  const message = await getLocalizedMessage("popup.confirmOpenObsidian");

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (msg: string) => {
      return window.confirm(msg);
    },
    args: [message],
  });

  return results[0]?.result === true;
}

/**
 * Wait for Obsidian to connect with retries
 */
async function waitForObsidianConnection(
  maxRetries: number = 5,
  delayMs: number = 2000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(
      `[Web2Obsidian] Waiting for Obsidian to start (attempt ${attempt}/${maxRetries})...`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const connected = await checkObsidianConnection();
    if (connected) {
      console.log("[Web2Obsidian] Obsidian connected after opening");
      return true;
    }
  }
  return false;
}

/**
 * Ensure Obsidian is connected, showing confirmation dialog if needed
 * Returns true if connected, false if user cancelled or connection failed
 */
async function ensureObsidianConnected(
  tabId: number
): Promise<{ connected: boolean; cancelled?: boolean }> {
  const isConnected = await checkObsidianConnection();

  if (isConnected) {
    return { connected: true };
  }

  // Ask user if they want to open Obsidian
  const confirmed = await showOpenObsidianConfirmation(tabId);

  if (!confirmed) {
    console.log("[Web2Obsidian] User cancelled opening Obsidian");
    return { connected: false, cancelled: true };
  }

  // Open Obsidian
  const settings = await chrome.storage.sync.get(["vaultName"]);
  await openObsidianVaultFromServiceWorker(settings.vaultName);

  // Wait for connection
  const connected = await waitForObsidianConnection();

  if (!connected) {
    const errorMsg = await getLocalizedMessage("popup.connectionError");
    await showNotification("connection-error", errorMsg, "error");
  }

  return { connected };
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.url) {
    console.warn("[Web2Obsidian] No valid tab for context menu action");
    return;
  }

  // Check if it's a clippable page
  const url = new URL(tab.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  const menuItemId = String(info.menuItemId);

  // Determine which template to use
  let templateId: string | undefined;
  if (
    menuItemId.startsWith("clip-page-") ||
    menuItemId.startsWith("clip-selection-")
  ) {
    const prefix = menuItemId.startsWith("clip-page-")
      ? "clip-page-"
      : "clip-selection-";
    templateId = menuItemId.slice(prefix.length);
  }

  try {
    // Ensure Obsidian is connected
    const { connected, cancelled } = await ensureObsidianConnected(tab.id);
    if (!connected || cancelled) {
      return;
    }

    // Proceed with clipping
    await startClipTask(templateId);
  } catch (error) {
    console.error("[Web2Obsidian] Context menu action failed:", error);
    const errorMsg = await getLocalizedMessage("toast.error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    await showNotification("context-menu-error", errorMsg, "error");
  }
});

// Update context menus when language or template settings change
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "sync" && changes.language) {
    await createContextMenus();
  }
  if (areaName === "local" && changes.templateSettings) {
    await createContextMenus();
  }
});

// Keep service worker alive and log startup
console.log("Web2Obsidian service worker started");

// Message types
interface ClipPageMessage {
  type: "CLIP_PAGE";
  data?: {
    templateId?: string;
  };
}

interface GetPageInfoMessage {
  type: "GET_PAGE_INFO";
}

interface GetTasksMessage {
  type: "GET_TASKS";
}

interface CheckConnectionMessage {
  type: "CHECK_OBSIDIAN_CONNECTION";
}

interface OpenObsidianMessage {
  type: "OPEN_OBSIDIAN";
}

interface ClipWithConnectionCheckMessage {
  type: "CLIP_WITH_CONNECTION_CHECK";
  data?: {
    templateId?: string;
  };
}

type Message =
  | ClipPageMessage
  | GetPageInfoMessage
  | GetTasksMessage
  | CheckConnectionMessage
  | OpenObsidianMessage
  | ClipWithConnectionCheckMessage
  | { type: string; data?: unknown };

// Message handler for communication between popup/content scripts and background
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    switch (message.type) {
      case "CLIP_PAGE":
        // Start clip process and return task ID immediately
        startClipTask((message as ClipPageMessage).data?.templateId)
          .then((taskId) => {
            console.log("[Web2Obsidian] Clip task started:", taskId);
            sendResponse({ success: true, taskId });
          })
          .catch(async (error) => {
            console.error("[Web2Obsidian] Failed to start clip task:", error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "GET_TASKS":
        getTaskHistory()
          .then((history) => {
            sendResponse({ success: true, tasks: history.tasks });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "GET_PAGE_INFO":
        getPageInfoFromActiveTab()
          .then((info) => sendResponse({ success: true, data: info }))
          .catch((error) =>
            sendResponse({ success: false, error: error.message })
          );
        return true;

      case "CHECK_OBSIDIAN_CONNECTION":
        (async () => {
          try {
            const settings = await chrome.storage.sync.get([
              "obsidianApiSettings",
            ]);
            const obsidianApiSettings: ObsidianApiSettings =
              settings.obsidianApiSettings ||
              createDefaultObsidianApiSettings();

            if (!obsidianApiSettings.apiKey) {
              sendResponse({
                success: false,
                connected: false,
                error: "API key not configured",
              });
              return;
            }

            const result = await testObsidianConnection(obsidianApiSettings);
            sendResponse({
              success: true,
              connected: result.success,
              error: result.error,
            });
          } catch (error) {
            sendResponse({
              success: false,
              connected: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })();
        return true;

      case "OPEN_OBSIDIAN":
        (async () => {
          try {
            const settings = await chrome.storage.sync.get(["vaultName"]);
            await openObsidianVaultFromServiceWorker(settings.vaultName);
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })();
        return true;

      case "CLIP_WITH_CONNECTION_CHECK":
        (async () => {
          try {
            const tab = await getActiveTab();
            if (!tab.id) {
              sendResponse({ success: false, error: "No active tab" });
              return;
            }

            // Ensure Obsidian is connected
            const { connected, cancelled } = await ensureObsidianConnected(
              tab.id
            );
            if (cancelled) {
              sendResponse({ success: false, cancelled: true });
              return;
            }
            if (!connected) {
              sendResponse({
                success: false,
                error: "Could not connect to Obsidian",
              });
              return;
            }

            // Proceed with clipping
            const templateId = (message as ClipWithConnectionCheckMessage).data
              ?.templateId;
            const taskId = await startClipTask(templateId);
            sendResponse({ success: true, taskId });
          } catch (error) {
            console.error(
              "[Web2Obsidian] CLIP_WITH_CONNECTION_CHECK failed:",
              error
            );
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })();
        return true;

      default:
        sendResponse({ success: false, error: "Unknown message type" });
        return false;
    }
  }
);

// ============================================================================
// Clip Task Processing
// ============================================================================

/**
 * Start a new clip task - extracts page info and starts background processing
 */
async function startClipTask(templateId?: string): Promise<string> {
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

  if (!obsidianApiSettings.apiKey) {
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
  try {
    // Get remaining settings
    const settings = await chrome.storage.sync.get([
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
        model
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
        model
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
    await updateTaskStep(taskId, "saving");
    console.log("[Web2Obsidian] Saving note via Local REST API...");

    const apiResult = await saveToObsidian({
      folder: processedNote.folder,
      filename: processedNote.filename,
      content: processedNote.content,
      settings: obsidianApiSettings,
    });

    if (!apiResult.success) {
      throw new Error(apiResult.error || "Failed to save to Obsidian");
    }

    // Mark task as completed
    await completeTask(taskId, { path: apiResult.path || "" });
    console.log("[Web2Obsidian] Task completed:", taskId, apiResult.path);

    // Show success notification
    const successMsg = await getLocalizedMessage("toast.success");
    await showNotification(taskId, successMsg, "success");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await failTask(taskId, errorMessage);
    console.error("[Web2Obsidian] Task failed:", taskId, errorMessage);

    // Show error notification
    const errorMsg = await getLocalizedMessage("toast.error", {
      error: errorMessage,
    });
    await showNotification(taskId, errorMsg, "error");
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.id) {
    throw new Error("No active tab found");
  }

  return tab;
}

async function getPageInfoFromActiveTab(): Promise<PageInfo | YouTubeInfo> {
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

/**
 * Show a browser notification
 */
async function showNotification(
  notificationId: string,
  message: string,
  type: "success" | "error"
): Promise<void> {
  try {
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "Web2Obsidian",
      message,
      priority: type === "error" ? 2 : 1,
    });

    // Auto-clear after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 5000);
  } catch (error) {
    console.warn("[Web2Obsidian] Failed to show notification:", error);
  }
}

export {};
