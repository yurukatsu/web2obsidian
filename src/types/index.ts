// Page content types
export interface PageContent {
  title: string;
  url: string;
  content: string;
  html?: string;
  description?: string;
}

// YouTube specific types
export interface YouTubeTranscript {
  videoId: string;
  title: string;
  transcript: TranscriptSegment[];
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

// Extension message types
export type MessageType =
  | "CAPTURE_PAGE"
  | "GET_PAGE_CONTENT"
  | "GET_PAGE_INFO"
  | "GET_YOUTUBE_TRANSCRIPT";

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  data?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Settings types
export interface GeneralSettings {
  vaultName: string;
  defaultFolder: string;
}

// Note: ShortcutSettings has been removed.
// Shortcuts are now part of TemplateSet in template.ts

export interface AppSettings {
  language: "en" | "ja";
  theme: "light" | "dark" | "system";
}

export type Settings = GeneralSettings & AppSettings;

// AI Summary types
export interface AISummaryRequest {
  content: string;
  type: "webpage" | "youtube";
  language: "en" | "ja";
}

export interface AISummaryResponse {
  summary: string;
  keyPoints: string[];
  tags: string[];
}
