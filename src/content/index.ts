// Content script for Web2Obsidian extension
// This script runs on web pages and can access the DOM
console.log("[Web2Obsidian] Content script loaded on:", window.location.href);

import Defuddle from "defuddle";
import { htmlToMarkdown } from "../utils/index";

export interface PageInfo {
  title: string;
  url: string;
  domain: string;
  description: string;
  author: string;
  published: string;
  content: string;
  contentHtml: string;
  contentMarkdown: string;
  selection: string;
  selectionHtml: string;
  selectionMarkdown: string;
}

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

function getPageInfo(): PageInfo {
  const url = window.location.href;
  const domain = window.location.hostname.replace(/^www\./, "");

  // Get selected text and HTML
  const selectionObj = window.getSelection();
  const selection = selectionObj?.toString() || "";
  let selectionHtml = "";
  if (selectionObj && selectionObj.rangeCount > 0) {
    const range = selectionObj.getRangeAt(0);
    const div = document.createElement("div");
    div.appendChild(range.cloneContents());
    selectionHtml = div.innerHTML;
  }

  // Convert selection HTML to markdown (with error handling)
  let selectionMarkdown = selection;
  if (selectionHtml) {
    try {
      selectionMarkdown = htmlToMarkdown(selectionHtml);
    } catch (error) {
      console.warn(
        "[Web2Obsidian] Failed to convert selection to markdown:",
        error
      );
      selectionMarkdown = selection;
    }
  }

  // Use Defuddle to extract main content
  try {
    const defuddle = new Defuddle(document);
    const article = defuddle.parse();

    // Convert HTML content to plain text for the text-only content field
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = article.content || "";
    const plainTextContent = tempDiv.textContent || tempDiv.innerText || "";

    // Convert HTML to markdown (with error handling)
    let contentMarkdown = plainTextContent;
    if (article.content) {
      try {
        contentMarkdown = htmlToMarkdown(article.content);
      } catch (error) {
        console.warn(
          "[Web2Obsidian] Failed to convert content to markdown:",
          error
        );
        contentMarkdown = plainTextContent;
      }
    }

    return {
      title: article.title || document.title || "",
      url,
      domain,
      description: article.description || getMetaContent("description") || "",
      author: article.author || getMetaContent("author") || "",
      published: formatPublishedDate(
        article.published || getMetaContent("article:published_time") || ""
      ),
      content: plainTextContent,
      contentHtml: article.content || "",
      contentMarkdown,
      selection,
      selectionHtml,
      selectionMarkdown,
    };
  } catch (error) {
    console.error("[Web2Obsidian] Defuddle extraction failed:", error);
    // Fallback to basic extraction
    let fallbackContentMarkdown = "";
    try {
      fallbackContentMarkdown = htmlToMarkdown(document.body.innerHTML || "");
    } catch (mdError) {
      console.warn(
        "[Web2Obsidian] Fallback markdown conversion failed:",
        mdError
      );
      fallbackContentMarkdown = document.body.textContent || "";
    }
    return {
      title: document.title || "",
      url,
      domain,
      description: getMetaContent("description") || "",
      author: getMetaContent("author") || "",
      published: formatPublishedDate(
        getMetaContent("article:published_time") || ""
      ),
      content: document.body.textContent || "",
      contentHtml: document.body.innerHTML || "",
      contentMarkdown: fallbackContentMarkdown,
      selection,
      selectionHtml,
      selectionMarkdown,
    };
  }
}

function getMetaContent(name: string): string {
  // Try various meta tag formats
  const selectors = [
    `meta[name="${name}"]`,
    `meta[property="${name}"]`,
    `meta[itemprop="${name}"]`,
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.getAttribute("content") || "";
    }
  }

  return "";
}

function formatPublishedDate(dateStr: string): string {
  if (!dateStr) return "";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}

export interface YouTubeInfo {
  title: string;
  url: string;
  videoId: string;
  channel: string;
  duration: string;
  published: string;
  description: string;
  transcript: string;
}

async function getYouTubeInfo(): Promise<YouTubeInfo | null> {
  // Check if this is a YouTube video page
  if (!window.location.hostname.includes("youtube.com")) {
    return null;
  }

  const url = window.location.href;
  const urlObj = new URL(url);
  const videoId = urlObj.searchParams.get("v") || "";

  if (!videoId) {
    return null;
  }

  // Get title
  const title =
    document.querySelector("h1.ytd-video-primary-info-renderer")?.textContent ||
    document.querySelector("h1.title")?.textContent ||
    document.title.replace(" - YouTube", "") ||
    "";

  // Get channel name
  const channel =
    document.querySelector("#channel-name a")?.textContent ||
    document.querySelector(".ytd-channel-name a")?.textContent ||
    "";

  // Get description
  const description =
    document.querySelector("#description-inline-expander")?.textContent ||
    document.querySelector("#description")?.textContent ||
    "";

  // Get published date (from structured data if available)
  const publishedMeta = document.querySelector(
    'meta[itemprop="datePublished"]'
  );
  const published = publishedMeta?.getAttribute("content") || "";

  // Get duration from structured data
  const durationMeta = document.querySelector('meta[itemprop="duration"]');
  const duration = durationMeta?.getAttribute("content") || "";

  // Extract transcript
  let transcript = "";
  try {
    transcript = await extractYouTubeTranscript(videoId);
    console.log(
      "[Web2Obsidian] Transcript extracted:",
      transcript.length,
      "characters"
    );
  } catch (error) {
    console.warn("[Web2Obsidian] Failed to extract transcript:", error);
  }

  return {
    title: title.trim(),
    url,
    videoId,
    channel: channel.trim(),
    duration,
    published: formatPublishedDate(published),
    description: description.replace(/\s+/g, " ").trim().slice(0, 50000),
    transcript,
  };
}

/**
 * Extract transcript from YouTube video
 * Uses InnerTube API approach (same as youtube-transcript-api Python library)
 */
async function extractYouTubeTranscript(videoId: string): Promise<string> {
  try {
    // Step 1: Fetch the video page HTML to get the InnerTube API key
    console.log("[Web2Obsidian] Fetching video page for API key...");
    const htmlResponse = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );
    const html = await htmlResponse.text();

    // Step 2: Extract InnerTube API key from HTML
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
    if (!apiKeyMatch) {
      console.log(
        "[Web2Obsidian] Could not find InnerTube API key, trying fallback..."
      );
      return await extractTranscriptFallback(html);
    }
    const apiKey = apiKeyMatch[1];
    console.log("[Web2Obsidian] Found InnerTube API key");

    // Step 3: Make InnerTube API request (mimicking Android client like youtube-transcript-api)
    const innertubeResponse = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "20.10.38",
            },
          },
          videoId: videoId,
        }),
      }
    );

    if (!innertubeResponse.ok) {
      console.log(
        "[Web2Obsidian] InnerTube API request failed:",
        innertubeResponse.status
      );
      return await extractTranscriptFallback(html);
    }

    const innertubeData = await innertubeResponse.json();

    // Step 4: Extract caption tracks from response
    const captions =
      innertubeData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captions || captions.length === 0) {
      console.log("[Web2Obsidian] No caption tracks in InnerTube response");
      return "";
    }

    console.log(
      "[Web2Obsidian] Found",
      captions.length,
      "caption tracks via InnerTube API"
    );

    // Step 5: Find the best caption track
    const captionTrack = selectBestCaptionTrack(captions);

    if (!captionTrack?.baseUrl) {
      console.log("[Web2Obsidian] No valid caption track found");
      return "";
    }

    console.log(
      "[Web2Obsidian] Using caption track:",
      captionTrack.languageCode,
      captionTrack.kind || "manual"
    );
    console.log("[Web2Obsidian] Caption baseUrl:", captionTrack.baseUrl);

    // Step 6: Fetch the caption XML
    const captionResponse = await fetch(captionTrack.baseUrl);
    console.log(
      "[Web2Obsidian] Caption response status:",
      captionResponse.status
    );
    const xml = await captionResponse.text();
    console.log("[Web2Obsidian] Caption XML length:", xml.length);
    console.log("[Web2Obsidian] Caption XML preview:", xml.substring(0, 500));
    return parseTranscriptXml(xml);
  } catch (error) {
    console.error("[Web2Obsidian] Failed to extract transcript:", error);
    return "";
  }
}

/**
 * Fallback method: Extract captions directly from HTML
 */
async function extractTranscriptFallback(html: string): Promise<string> {
  console.log("[Web2Obsidian] Using fallback HTML parsing method...");

  // Try to extract captions JSON by splitting HTML
  const splittedHtml = html.split('"captions":');

  if (splittedHtml.length < 2) {
    console.log("[Web2Obsidian] No captions found in video page HTML");
    return "";
  }

  // Parse the captions JSON
  const captionsJsonStr = splittedHtml[1]
    .split(',"videoDetails')[0]
    .replace(/\n/g, "");
  let captionsJson;
  try {
    captionsJson = JSON.parse(captionsJsonStr);
  } catch (parseError) {
    console.error("[Web2Obsidian] Failed to parse captions JSON:", parseError);
    return "";
  }

  const captions = captionsJson?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captions || captions.length === 0) {
    console.log("[Web2Obsidian] No caption tracks available in fallback");
    return "";
  }

  console.log(
    "[Web2Obsidian] Found",
    captions.length,
    "caption tracks via fallback"
  );

  const captionTrack = selectBestCaptionTrack(captions);

  if (!captionTrack?.baseUrl) {
    console.log("[Web2Obsidian] No valid caption track found in fallback");
    return "";
  }

  console.log(
    "[Web2Obsidian] Using caption track:",
    captionTrack.languageCode,
    captionTrack.kind || "manual"
  );

  const captionResponse = await fetch(captionTrack.baseUrl);
  const xml = await captionResponse.text();
  return parseTranscriptXml(xml);
}

/**
 * Select the best caption track based on language preference
 */
function selectBestCaptionTrack(
  captions: CaptionTrack[]
): CaptionTrack | undefined {
  const userLang = navigator.language.split("-")[0];

  // Priority: manual captions in user's language > manual in English > auto in user's language > auto in English > any
  let captionTrack = captions.find(
    (c: CaptionTrack) => !c.kind && c.languageCode === userLang
  );
  if (!captionTrack) {
    captionTrack = captions.find(
      (c: CaptionTrack) => !c.kind && c.languageCode === "en"
    );
  }
  if (!captionTrack) {
    captionTrack = captions.find(
      (c: CaptionTrack) => c.kind === "asr" && c.languageCode === userLang
    );
  }
  if (!captionTrack) {
    captionTrack = captions.find(
      (c: CaptionTrack) => c.kind === "asr" && c.languageCode === "en"
    );
  }
  if (!captionTrack) {
    captionTrack = captions[0];
  }

  return captionTrack;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText: string };
}

/**
 * Parse YouTube caption XML format to timestamped text
 * Supports both old format (<text> elements) and srv3 format (<p> elements)
 */
function parseTranscriptXml(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  // Try srv3 format first (newer format with <p> elements)
  let textElements = doc.querySelectorAll("body p");
  let timeAttr = "t"; // srv3 format uses "t" for time in milliseconds

  // Fall back to old format (<text> elements)
  if (textElements.length === 0) {
    textElements = doc.querySelectorAll("text");
    timeAttr = "start"; // old format uses "start" for time in seconds
  }

  console.log(
    "[Web2Obsidian] Found",
    textElements.length,
    "text elements in XML"
  );

  const segments: string[] = [];

  for (const element of textElements) {
    let text = element.textContent || "";
    // Decode HTML entities
    text = decodeHtmlEntities(text);
    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    if (text) {
      // Get timestamp
      const timeValue = element.getAttribute(timeAttr);
      const timestamp = formatTimestamp(timeValue, timeAttr === "t");
      segments.push(`${timestamp} ${text}`);
    }
  }

  return segments.join("\n");
}

/**
 * Format timestamp to MM:SS or HH:MM:SS format
 * @param timeValue - Time value from XML attribute
 * @param isMilliseconds - true if time is in milliseconds (srv3 format), false if in seconds
 */
function formatTimestamp(
  timeValue: string | null,
  isMilliseconds: boolean
): string {
  if (!timeValue) return "00:00";

  let totalSeconds: number;
  if (isMilliseconds) {
    totalSeconds = Math.floor(parseInt(timeValue, 10) / 1000);
  } else {
    totalSeconds = Math.floor(parseFloat(timeValue));
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Decode HTML entities in transcript text
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

// ============================================================================
// Toast Notification
// ============================================================================

let toastContainer: HTMLDivElement | null = null;

function showToast(
  message: string,
  type: "info" | "success" | "error" = "info"
): void {
  console.log("[Web2Obsidian] showToast called:", message, type);

  // Create container if it doesn't exist
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement("div");
    toastContainer.id = "web2obsidian-toast-container";
    toastContainer.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      pointer-events: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    `;
    document.body.appendChild(toastContainer);
    console.log("[Web2Obsidian] Toast container created");
  }

  // Create toast element
  const toast = document.createElement("div");
  const bgColor =
    type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#3b82f6";
  toast.style.cssText = `
    background: ${bgColor} !important;
    color: white !important;
    padding: 12px 16px !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    pointer-events: auto !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
  `;

  // Add icon
  const icon = type === "error" ? "✕" : type === "success" ? "✓" : "⟳";
  toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><span>${message}</span>`;

  toastContainer.appendChild(toast);
  console.log("[Web2Obsidian] Toast element added to container");

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.remove();
    console.log("[Web2Obsidian] Toast removed");
  }, 3000);
}

// ============================================================================
// Keyboard Shortcut Handler
// ============================================================================

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

// Register global keyboard shortcut listener
document.addEventListener("keydown", handleKeyboardShortcut);
console.log("[Web2Obsidian] Keyboard shortcut listener registered");

export {};
