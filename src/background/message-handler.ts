import type {
  Message,
  ClipPageMessage,
  ClipWithConnectionCheckMessage,
  CancelTaskMessage,
} from "./types";
import type { ObsidianApiSettings } from "../services/obsidian-api";
import {
  testObsidianConnection,
  openObsidianVaultFromServiceWorker,
  createDefaultObsidianApiSettings,
} from "../services/obsidian-api";
import {
  startClipTask,
  getActiveTab,
  getPageInfoFromActiveTab,
} from "./clip-pipeline";
import { getTaskHistory, cancelTask } from "./task-manager";
import { ensureObsidianConnected } from "./obsidian-connection";

/**
 * Register the central message handler for communication between
 * popup/content scripts and the background service worker
 */
export function registerMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (message: Message, _sender, sendResponse) => {
      switch (message.type) {
        case "CLIP_PAGE":
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

              // REST API disabled — URI mode doesn't need a connection check
              if (!obsidianApiSettings.enabled) {
                sendResponse({ success: true, connected: true });
                return;
              }

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
              const templateId = (message as ClipWithConnectionCheckMessage)
                .data?.templateId;
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

        case "CANCEL_TASK":
          (async () => {
            try {
              const taskId = (message as CancelTaskMessage).taskId;
              const cancelled = await cancelTask(taskId);
              sendResponse({ success: true, cancelled });
            } catch (error) {
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
}
