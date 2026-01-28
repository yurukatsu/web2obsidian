import type { YouTubeInfo } from "./types";

export async function getYouTubeInfo(): Promise<YouTubeInfo | null> {
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
 * Extract transcript from YouTube video.
 *
 * Strategy (ordered by reliability):
 * 1. Read window.ytInitialPlayerResponse via MAIN world injection
 *    (works for SPA navigations where script tag content is stale)
 * 2. Parse <script> tags in the DOM for ytInitialPlayerResponse
 *    (works on initial page load, no network request)
 * 3. Fetch page HTML and parse captions from it
 *    (original approach — works when DOM methods fail, but may fail behind corporate proxies)
 * 4. InnerTube API call
 *    (last resort, separate network request)
 */
async function extractYouTubeTranscript(videoId: string): Promise<string> {
  try {
    // Step 1: Try MAIN world — reads the live window variable (best for SPA)
    console.log(
      "[Web2Obsidian] Trying to read player response from MAIN world..."
    );
    const mainWorldCaptions = await extractCaptionsFromMainWorld();
    if (mainWorldCaptions && mainWorldCaptions.length > 0) {
      console.log(
        "[Web2Obsidian] Found",
        mainWorldCaptions.length,
        "caption tracks from MAIN world"
      );
      return await fetchAndParseCaption(mainWorldCaptions);
    }

    // Step 2: Try DOM script tags
    console.log("[Web2Obsidian] Trying DOM script tags...");
    const domCaptions = extractCaptionsFromPageDOM();
    if (domCaptions && domCaptions.length > 0) {
      console.log(
        "[Web2Obsidian] Found",
        domCaptions.length,
        "caption tracks from DOM script tags"
      );
      return await fetchAndParseCaption(domCaptions);
    }

    // Step 3: Fetch page HTML and parse captions
    console.log("[Web2Obsidian] Trying fetch-based extraction...");
    const fetchCaptions = await extractCaptionsViaFetch(videoId);
    if (fetchCaptions && fetchCaptions.length > 0) {
      console.log(
        "[Web2Obsidian] Found",
        fetchCaptions.length,
        "caption tracks via fetch"
      );
      return await fetchAndParseCaption(fetchCaptions);
    }

    // Step 4: InnerTube API
    console.log("[Web2Obsidian] Trying InnerTube API...");
    return await extractTranscriptViaInnerTube(videoId);
  } catch (error) {
    console.error("[Web2Obsidian] Failed to extract transcript:", error);
    return "";
  }
}

/**
 * Read window.ytInitialPlayerResponse from the page's MAIN world.
 * Content scripts run in an isolated world and can't access page variables
 * directly, so we inject a tiny script into MAIN world that dispatches
 * the caption data back via a CustomEvent.
 *
 * This is the most reliable method for SPA navigations where YouTube
 * updates the variable via JS without creating new <script> tags.
 */
function extractCaptionsFromMainWorld(): Promise<CaptionTrack[] | null> {
  return new Promise((resolve) => {
    const eventName = "__web2obsidian_captions";

    const handler = (event: Event) => {
      document.removeEventListener(eventName, handler);
      try {
        const detail = (event as CustomEvent).detail;
        const captions = JSON.parse(detail);
        resolve(captions && captions.length > 0 ? captions : null);
      } catch {
        resolve(null);
      }
    };

    document.addEventListener(eventName, handler);

    const script = document.createElement("script");
    script.textContent = `
      document.dispatchEvent(new CustomEvent("${eventName}", {
        detail: JSON.stringify(
          (window.ytInitialPlayerResponse || {})
            ?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
        )
      }));
    `;
    document.documentElement.appendChild(script);
    script.remove();

    // Timeout — if the event never fires, resolve null
    setTimeout(() => {
      document.removeEventListener(eventName, handler);
      resolve(null);
    }, 500);
  });
}

/**
 * Fetch the video page HTML and extract captions from it.
 * This is the original approach — makes a separate HTTP request.
 * Works reliably in most environments but may fail behind corporate proxies.
 */
async function extractCaptionsViaFetch(
  videoId: string
): Promise<CaptionTrack[] | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await response.text();

    const splittedHtml = html.split('"captions":');
    if (splittedHtml.length < 2) {
      return null;
    }

    const captionsJsonStr = splittedHtml[1]
      .split(',"videoDetails')[0]
      .replace(/\n/g, "");

    const captionsJson = JSON.parse(captionsJsonStr);
    const captions =
      captionsJson?.playerCaptionsTracklistRenderer?.captionTracks;

    return captions && captions.length > 0 ? captions : null;
  } catch {
    return null;
  }
}

/**
 * Extract caption tracks from the page's inline script tags.
 * YouTube embeds ytInitialPlayerResponse in a <script> tag that the
 * content script can read directly — no fetch required.
 */
function extractCaptionsFromPageDOM(): CaptionTrack[] | null {
  const scripts = document.querySelectorAll("script");

  for (const script of scripts) {
    const text = script.textContent || "";

    // Look for ytInitialPlayerResponse
    const marker = "ytInitialPlayerResponse";
    const idx = text.indexOf(marker);
    if (idx === -1) continue;

    try {
      // Find the JSON object start — skip "ytInitialPlayerResponse = " or similar
      const afterMarker = text.substring(idx + marker.length);
      const jsonStart = afterMarker.indexOf("{");
      if (jsonStart === -1) continue;

      // Find matching closing brace
      const jsonStr = extractJsonObject(afterMarker.substring(jsonStart));
      if (!jsonStr) continue;

      const playerResponse = JSON.parse(jsonStr);
      const captions =
        playerResponse?.captions?.playerCaptionsTracklistRenderer
          ?.captionTracks;

      if (captions && captions.length > 0) {
        return captions;
      }
    } catch {
      // Continue to next script tag
    }
  }

  return null;
}

/**
 * Extract a JSON object string by counting braces.
 * Handles nested objects correctly.
 */
function extractJsonObject(str: string): string | null {
  if (str[0] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return str.substring(0, i + 1);
      }
    }
  }

  return null;
}

/**
 * Fallback: Use InnerTube API to get caption tracks.
 * Makes a separate network request, which may fail behind corporate proxies.
 */
async function extractTranscriptViaInnerTube(videoId: string): Promise<string> {
  // Get InnerTube API key from page scripts
  const scripts = document.querySelectorAll("script");
  let apiKey: string | null = null;

  for (const script of scripts) {
    const text = script.textContent || "";
    const match = text.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
    if (match) {
      apiKey = match[1];
      break;
    }
  }

  if (!apiKey) {
    console.log("[Web2Obsidian] Could not find InnerTube API key");
    return "";
  }

  console.log("[Web2Obsidian] Found InnerTube API key, calling player API...");

  const response = await fetch(
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
        videoId,
      }),
    }
  );

  if (!response.ok) {
    console.log(
      "[Web2Obsidian] InnerTube API request failed:",
      response.status
    );
    return "";
  }

  const data = await response.json();
  const captions =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captions || captions.length === 0) {
    console.log("[Web2Obsidian] No caption tracks in InnerTube response");
    return "";
  }

  console.log(
    "[Web2Obsidian] Found",
    captions.length,
    "caption tracks via InnerTube API"
  );

  return await fetchAndParseCaption(captions);
}

/**
 * Given caption tracks, select the best one, fetch its XML, and parse it.
 */
async function fetchAndParseCaption(captions: CaptionTrack[]): Promise<string> {
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

  const captionResponse = await fetch(captionTrack.baseUrl);
  if (!captionResponse.ok) {
    console.log("[Web2Obsidian] Caption fetch failed:", captionResponse.status);
    return "";
  }

  const xml = await captionResponse.text();
  console.log("[Web2Obsidian] Caption XML length:", xml.length);
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
