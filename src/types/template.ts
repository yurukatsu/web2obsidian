// Template types for Web2Obsidian

export type TemplateType = "web" | "youtube";

export type PropertyInputType =
  | "text"
  | "list"
  | "checkbox"
  | "date"
  | "datetime"
  | "number"
  | "tags";

export const PROPERTY_INPUT_TYPES: PropertyInputType[] = [
  "text",
  "list",
  "checkbox",
  "date",
  "datetime",
  "number",
  "tags",
];

export interface TemplateProperty {
  key: string;
  value: string;
  inputType?: PropertyInputType;
  required?: boolean;
}

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  folder: string;
  filename: string;
  properties: TemplateProperty[];
  content: string;
  useLLM: boolean;
  llmProvider?: string; // Optional: override the default provider
  llmModel?: string; // Optional: override the default model from provider settings
  llmGenerateContent: boolean;
  llmPrompt: string;
  llmGenerateTags: boolean;
  llmTagsPrompt: string;
}

// Template Set - contains both web and youtube templates with a shortcut
export interface TemplateSet {
  id: string;
  name: string;
  shortcutKey: string | null;
  webTemplate: Template;
  youtubeTemplate: Template;
}

export interface TemplateSettings {
  // All template sets (no limit)
  sets: TemplateSet[];
  // ID of the default template set
  defaultSetId: string;
}

// Legacy settings interface for migration
export interface LegacyTemplateSettings {
  templates: Template[];
  defaultWebTemplateId: string | null;
  defaultYouTubeTemplateId: string | null;
}

// Default LLM prompts
export const DEFAULT_WEB_LLM_PROMPT = `You are an expert knowledge editor.

You will be given raw text extracted from a web page's HTML.
This text may contain navigation menus, headers, footers, ads, buttons, tabs, cookie notices, captions, and other non-article elements mixed with the real content.

Your task is to:

1) Identify and keep ONLY the main article/content body
2) Discard all non-content noise
3) Convert the cleaned content into a knowledge-structured Markdown note optimized for Obsidian

Follow these instructions strictly.

# Step 1 — Content Cleaning (very important)

From the given text, REMOVE anything that is not part of the main article, including:

- Navigation menus
- Headers / footers
- Sidebars
- Related links
- Ads / promotions
- Cookie banners
- Buttons / UI labels
- Tab labels
- Image captions unless they add real information
- Repeated site branding
- Social sharing text
- Comment sections

Keep only paragraphs that form the logical flow of the article.

If unsure whether text is content or UI noise, discard it.

# Step 2 — Understand the Article Structure

Identify the logical structure and topic shifts of the article.
Infer section boundaries even if headings are missing.

# Step 3 — Produce Markdown in This Exact Structure

Output Markdown with the following sections:

---

# <Title reflecting the main topic of the article>

## Summary
A concise but informative summary of the whole article (5–8 lines).

## Key Insights
- Main arguments
- Important perspectives
- Notable insights
- Cause-and-effect relationships

## Structured Notes

### Section 1
Rewrite the content into clean, readable prose.

### Section 2
Continue based on logical topic shifts.

(Add as many sections as needed.)

## Important Quotes
Include the most valuable original sentences worth quoting, using blockquote format.

## Data / Facts / Numbers
Extract all concrete data and present them in a table:

| Item | Value | Context |
|------|-------|---------|

## Open Questions / Implications
- Questions raised by the article
- Connections to broader themes
- Potential implications

# Style Rules

- Write in neutral, professional tone
- Do NOT copy the article verbatim except in the Quotes section
- Do NOT include any HTML noise
- Do NOT include navigation text
- Preserve factual accuracy
- Make it easy to read and scan

Return Markdown only.

Here is the raw HTML-extracted text:
{{content}}`;

export const DEFAULT_YOUTUBE_LLM_PROMPT = `You are an expert knowledge editor.

You will be given a raw, timestamped YouTube transcript.

Your task is NOT to reproduce the transcript, but to transform it into a knowledge-structured Markdown note optimized for Obsidian, while keeping the original transcript available as a clean reference table at the end.

Follow these instructions strictly.

# Objectives

- Make the content easy to understand
- Reconstruct the logical flow of the story
- Remove transcript-style fragmentation
- Preserve all important facts and context
- Separate “reading content” from “reference content”
- Keep timestamps only in the reference section

# Step 1 — Understand the Narrative

Identify topic shifts and the logical progression of the video.
Ignore timestamps during understanding.

# Step 2 — Produce Markdown in This Exact Structure

Output Markdown with the following sections in this order:

---

# <Title reflecting the main topic of the video>

## Summary
A concise but informative summary of the entire content.

## Key Points
- Most important arguments, facts, and conclusions
- Key cause-and-effect relationships

## Structured Notes

### Section 1
Rewrite into clean, readable prose (no timestamps, no transcript style).

### Section 2
Continue based on topic shifts.

(Add sections as needed.)

---

## Transcript (Reference)

Present the original transcript as a Markdown table:

| Time | Transcript |
|------|------------|

Keep every original line.
Keep timestamps exactly as they appear.
Do not rewrite transcript text.

# Style Rules

- Neutral, professional tone
- Remove repetition and filler words in Structured Notes
- Do NOT omit important explanations
- Do NOT add commentary

Return Markdown only.

Here is the transcript:


{{transcript}}`;

export const DEFAULT_WEB_TAGS_PROMPT = `Analyze the following web page content and generate relevant tags for organizing this note in a personal knowledge base.

Guidelines:
- Generate 3-7 tags that capture the main topics, themes, and concepts
- Use lowercase words separated by hyphens for multi-word tags (e.g., "machine-learning")
- Include a mix of broad categories and specific topics
- Prioritize tags that would be useful for finding this content later
- Consider: subject area, content type (article, tutorial, reference), key technologies/concepts

Return ONLY a valid JSON array of tag strings, nothing else.
Example: ["programming", "javascript", "web-development", "tutorial"]

Content:
{{content}}`;

export const DEFAULT_YOUTUBE_TAGS_PROMPT = `Analyze the following YouTube video transcript and generate relevant tags for organizing this note in a personal knowledge base.

Guidelines:
- Generate 3-7 tags that capture the main topics, themes, and concepts
- Use lowercase words separated by hyphens for multi-word tags (e.g., "machine-learning")
- Include a mix of broad categories and specific topics
- Prioritize tags that would be useful for finding this content later
- Consider: subject area, content type (tutorial, review, discussion), key technologies/concepts, creator's niche

Return ONLY a valid JSON array of tag strings, nothing else.
Example: ["programming", "python", "data-science", "tutorial"]

Transcript:
{{transcript}}`;

// Required properties for each template type
export const getRequiredWebProperties = (): TemplateProperty[] => [
  { key: "title", value: "{{title}}", inputType: "text", required: true },
  { key: "source", value: "{{url}}", inputType: "text", required: true },
  { key: "author", value: "{{author}}", inputType: "list", required: true },
  {
    key: "published",
    value: "{{published}}",
    inputType: "date",
    required: true,
  },
  {
    key: "created",
    value: "{{datetime}}",
    inputType: "datetime",
    required: true,
  },
  { key: "tags", value: "[]", inputType: "tags", required: true },
];

export const getRequiredYouTubeProperties = (): TemplateProperty[] => [
  { key: "title", value: "{{title}}", inputType: "text", required: true },
  { key: "source", value: "{{url}}", inputType: "text", required: true },
  { key: "author", value: "{{channel}}", inputType: "list", required: true },
  {
    key: "published",
    value: "{{published}}",
    inputType: "date",
    required: true,
  },
  {
    key: "created",
    value: "{{datetime}}",
    inputType: "datetime",
    required: true,
  },
  { key: "tags", value: "[]", inputType: "tags", required: true },
];

// Default templates
export const createDefaultWebTemplate = (): Template => ({
  id: "web-default",
  name: "Default Web",
  type: "web",
  folder: "Clippings/{{domain}}",
  filename: "{{title}}",
  properties: getRequiredWebProperties(),
  content: "{{content}}",
  useLLM: false,
  llmGenerateContent: true,
  llmPrompt: DEFAULT_WEB_LLM_PROMPT,
  llmGenerateTags: false,
  llmTagsPrompt: DEFAULT_WEB_TAGS_PROMPT,
});

export const createDefaultYouTubeTemplate = (): Template => ({
  id: "youtube-default",
  name: "Default YouTube",
  type: "youtube",
  folder: "Clippings/YouTube",
  filename: "{{title}}",
  properties: getRequiredYouTubeProperties(),
  content: "{{content}}",
  useLLM: false,
  llmGenerateContent: true,
  llmPrompt: DEFAULT_YOUTUBE_LLM_PROMPT,
  llmGenerateTags: false,
  llmTagsPrompt: DEFAULT_YOUTUBE_TAGS_PROMPT,
});

// Create a default template set
export const createDefaultTemplateSet = (): TemplateSet => ({
  id: "default",
  name: "Default",
  shortcutKey: "Ctrl+Shift+C",
  webTemplate: createDefaultWebTemplate(),
  youtubeTemplate: createDefaultYouTubeTemplate(),
});

// Create a new template set with unique ID
export const createNewTemplateSet = (name: string): TemplateSet => {
  const id = generateTemplateSetId();
  return {
    id,
    name,
    shortcutKey: null,
    webTemplate: {
      ...createDefaultWebTemplate(),
      id: `${id}-web`,
      name: `${name} Web`,
    },
    youtubeTemplate: {
      ...createDefaultYouTubeTemplate(),
      id: `${id}-youtube`,
      name: `${name} YouTube`,
    },
  };
};

export const createDefaultTemplateSettings = (): TemplateSettings => {
  const defaultSet = createDefaultTemplateSet();
  return {
    sets: [defaultSet],
    defaultSetId: defaultSet.id,
  };
};

// Generate unique template set ID
export const generateTemplateSetId = (): string => {
  return `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate unique template ID
export const generateTemplateId = (type: TemplateType): string => {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Legacy settings interface for migration from old structure (defaultSet + customSets)
export interface LegacyTemplateSettingsV2 {
  defaultSet: TemplateSet;
  customSets: TemplateSet[];
}

// Migration helper: convert legacy template array settings to new format
export const migrateTemplateSettings = (
  legacy: LegacyTemplateSettings
): TemplateSettings => {
  const defaultWeb =
    legacy.templates.find((t) => t.id === legacy.defaultWebTemplateId) ||
    legacy.templates.find((t) => t.type === "web") ||
    createDefaultWebTemplate();

  const defaultYouTube =
    legacy.templates.find((t) => t.id === legacy.defaultYouTubeTemplateId) ||
    legacy.templates.find((t) => t.type === "youtube") ||
    createDefaultYouTubeTemplate();

  // Create default set from legacy defaults
  const defaultSet: TemplateSet = {
    id: "default",
    name: "Default",
    shortcutKey: "Ctrl+Shift+C",
    webTemplate: defaultWeb,
    youtubeTemplate: defaultYouTube,
  };

  const sets: TemplateSet[] = [defaultSet];

  // Create additional sets from remaining templates
  const remainingWeb = legacy.templates.filter(
    (t) => t.type === "web" && t.id !== defaultWeb.id
  );
  const remainingYouTube = legacy.templates.filter(
    (t) => t.type === "youtube" && t.id !== defaultYouTube.id
  );

  const maxSets = Math.max(remainingWeb.length, remainingYouTube.length);

  for (let i = 0; i < maxSets; i++) {
    const setId = generateTemplateSetId();
    sets.push({
      id: setId,
      name:
        remainingWeb[i]?.name || remainingYouTube[i]?.name || `Set ${i + 1}`,
      shortcutKey: null,
      webTemplate: remainingWeb[i] || {
        ...createDefaultWebTemplate(),
        id: `${setId}-web`,
        name: `Web Template ${i + 1}`,
      },
      youtubeTemplate: remainingYouTube[i] || {
        ...createDefaultYouTubeTemplate(),
        id: `${setId}-youtube`,
        name: `YouTube Template ${i + 1}`,
      },
    });
  }

  return { sets, defaultSetId: "default" };
};

// Migration helper: convert V2 settings (defaultSet + customSets) to new format
export const migrateTemplateSettingsV2 = (
  legacy: LegacyTemplateSettingsV2
): TemplateSettings => {
  const sets: TemplateSet[] = [legacy.defaultSet, ...(legacy.customSets || [])];
  return {
    sets,
    defaultSetId: legacy.defaultSet.id,
  };
};
