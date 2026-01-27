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
