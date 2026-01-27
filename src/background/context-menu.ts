import type { TemplateSettings } from "../types/template";
import { createDefaultTemplateSettings } from "../types/template";
import { getLocalizedMessage } from "./i18n";
import { ensureObsidianConnected } from "./obsidian-connection";
import { startClipTask } from "./clip-pipeline";
import { showNotification } from "./notifications";

/**
 * Create context menu items with template sets
 */
export async function createContextMenus(): Promise<void> {
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
 * Register context menu click listener
 */
export function registerContextMenuListeners(): void {
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
}
