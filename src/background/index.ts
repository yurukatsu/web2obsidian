// Background service worker for Web2Obsidian extension

import { createDefaultTemplateSettings } from "../types/template";
import { createContextMenus } from "./context-menu";
import { registerContextMenuListeners } from "./context-menu";
import { registerMessageHandler } from "./message-handler";

// ============================================================================
// Extension Initialization
// ============================================================================

// Guard to prevent storage.onChanged from re-creating context menus during initial setup
let isInitializing = false;

// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Web2Obsidian extension installed");

  isInitializing = true;
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
  } finally {
    isInitializing = false;
  }
});

// ============================================================================
// Register Listeners
// ============================================================================

// Context menu click handler
registerContextMenuListeners();

// Message handler for popup/content script communication
registerMessageHandler();

// Update context menus when language or template settings change
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (isInitializing) return;
  if (areaName === "sync" && changes.language) {
    await createContextMenus();
  }
  if (areaName === "local" && changes.templateSettings) {
    await createContextMenus();
  }
});

// Keep service worker alive and log startup
console.log("Web2Obsidian service worker started");

export {};
