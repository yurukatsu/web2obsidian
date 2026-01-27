// Content script for Web2Obsidian extension
// This script runs on web pages and can access the DOM
console.log("[Web2Obsidian] Content script loaded on:", window.location.href);

import { getPageInfo } from "./page-extractor";
import { getYouTubeInfo } from "./youtube-extractor";
import { registerKeyboardShortcuts } from "./keyboard-shortcuts";

// Re-export types for background script import
export type { PageInfo, YouTubeInfo } from "./types";

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "GET_PAGE_INFO":
      try {
        const pageInfo = getPageInfo();
        sendResponse({
          success: true,
          data: pageInfo,
        });
      } catch (error) {
        console.error("[Web2Obsidian] Failed to get page info:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      break;

    case "GET_YOUTUBE_INFO":
      getYouTubeInfo()
        .then((info) => sendResponse({ success: true, data: info }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Keep channel open for async

    default:
      sendResponse({ success: false, error: "Unknown message type" });
  }
  return false;
});

// Register global keyboard shortcuts
registerKeyboardShortcuts();

export {};
