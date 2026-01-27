import { showToast } from "./toast";

// Simplified TemplateSet interface for content script
interface TemplateSetForShortcut {
  id: string;
  shortcutKey: string | null;
}

interface TemplateSettingsForShortcut {
  sets: TemplateSetForShortcut[];
  defaultSetId: string;
}

/**
 * Handle global keyboard shortcuts
 */
async function handleKeyboardShortcut(e: KeyboardEvent): Promise<void> {
  // Ignore when in input fields
  const target = e.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return;
  }

  // Ignore if only modifier keys
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
    return;
  }

  // Generate key combination string
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");

  // Normalize key name
  let key = e.key;
  if (key.length === 1) {
    key = key.toUpperCase();
  } else if (key === " ") {
    key = "Space";
  }
  parts.push(key);

  const pressedShortcut = parts.join("+");

  // Get template settings from local storage and match shortcuts
  try {
    const result = await chrome.storage.local.get(["templateSettings"]);
    const settings: TemplateSettingsForShortcut = result.templateSettings || {
      sets: [{ id: "default", shortcutKey: "Ctrl+Shift+C" }],
      defaultSetId: "default",
    };

    let templateSetId: string | undefined;
    let matched = false;

    // Check all sets for matching shortcut
    for (const set of settings.sets || []) {
      if (set.shortcutKey === pressedShortcut) {
        matched = true;
        templateSetId = set.id;
        break;
      }
    }

    if (matched) {
      e.preventDefault();
      e.stopPropagation();

      console.log(
        "[Web2Obsidian] Shortcut triggered:",
        pressedShortcut,
        "templateSetId:",
        templateSetId
      );

      // Show toast notification
      showToast("Clipping...", "info");

      // Send message to background script (handles connection check + clip)
      chrome.runtime.sendMessage(
        {
          type: "CLIP_WITH_CONNECTION_CHECK",
          data: { templateId: templateSetId },
        },
        (response) => {
          if (response?.cancelled) {
            console.log("[Web2Obsidian] User cancelled");
          } else if (!response?.success) {
            showToast(response?.error || "Failed to clip", "error");
          }
        }
      );
    }
  } catch (error) {
    console.error("[Web2Obsidian] Failed to handle shortcut:", error);
  }
}

/**
 * Register global keyboard shortcut listener
 */
export function registerKeyboardShortcuts(): void {
  document.addEventListener("keydown", handleKeyboardShortcut);
  console.log("[Web2Obsidian] Keyboard shortcut listener registered");
}
