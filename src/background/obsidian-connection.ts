import {
  testObsidianConnection,
  openObsidianVaultFromServiceWorker,
  createDefaultObsidianApiSettings,
  type ObsidianApiSettings,
} from "../services/obsidian-api";
import { getLocalizedMessage } from "./i18n";
import { showNotification } from "./notifications";

/**
 * Check if Obsidian is connected
 */
export async function checkObsidianConnection(): Promise<boolean> {
  try {
    const settings = await chrome.storage.sync.get(["obsidianApiSettings"]);
    const obsidianApiSettings: ObsidianApiSettings =
      settings.obsidianApiSettings || createDefaultObsidianApiSettings();

    // REST API disabled — URI mode doesn't need a connection check
    if (!obsidianApiSettings.enabled) {
      return true;
    }

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
export async function ensureObsidianConnected(
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
