// Utility functions for Web2Obsidian

import TurndownService from "turndown";

/**
 * Check if the current URL is a YouTube video page
 */
export function isYouTubeVideo(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      (urlObj.hostname === "www.youtube.com" ||
        urlObj.hostname === "youtube.com") &&
      urlObj.pathname === "/watch"
    );
  } catch {
    return false;
  }
}

/**
 * Extract YouTube video ID from URL
 */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (
      urlObj.hostname === "www.youtube.com" ||
      urlObj.hostname === "youtube.com"
    ) {
      return urlObj.searchParams.get("v");
    }
    if (urlObj.hostname === "youtu.be") {
      return urlObj.pathname.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitize filename for Obsidian
 */
export function sanitizeFilename(name: string): string {
  // Remove or replace characters not allowed in filenames
  return name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200); // Limit length
}

/**
 * Create and configure TurndownService for HTML to Markdown conversion
 */
function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  // Remove unwanted elements
  turndownService.remove([
    "script",
    "style",
    "noscript",
    "iframe",
    "video",
    "audio",
    "embed",
    "object",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "canvas",
    "header",
    "nav",
    "footer",
    "aside",
  ]);

  // Remove SVG elements
  turndownService.addRule("removeSvg", {
    filter: (node) => node.nodeName === "SVG",
    replacement: () => "",
  });

  // Custom rule for strikethrough
  turndownService.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: function (content) {
      return "~~" + content + "~~";
    },
  });

  // Handle <strike> separately
  turndownService.addRule("strikeOld", {
    filter: (node) => node.nodeName === "STRIKE",
    replacement: (content) => "~~" + content + "~~",
  });

  // Custom rule for code blocks with language
  turndownService.addRule("fencedCodeBlock", {
    filter: function (node, options) {
      return !!(
        options.codeBlockStyle === "fenced" &&
        node.nodeName === "PRE" &&
        node.firstChild &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement: function (_content, node) {
      const codeNode = node.firstChild as Element;
      const className = codeNode.getAttribute("class") || "";
      const languageMatch = className.match(/language-(\S+)/);
      const language = languageMatch ? languageMatch[1] : "";
      const code = codeNode.textContent || "";
      return "\n\n```" + language + "\n" + code + "\n```\n\n";
    },
  });

  return turndownService;
}

// Singleton instance
let turndownInstance: TurndownService | null = null;

function getTurndownService(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = createTurndownService();
  }
  return turndownInstance;
}

/**
 * Convert HTML to Markdown using Turndown
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  // Pre-process: remove comments
  let cleaned = html.replace(/<!--[\s\S]*?-->/g, "");

  // Pre-process: remove common ad/social containers and hidden elements by class patterns
  cleaned = cleaned.replace(
    /<[^>]*class="[^"]*(?:ad|ads|advert|banner|sponsor|social|share|sharing|newsletter|popup|modal|hidden)[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi,
    ""
  );

  const turndownService = getTurndownService();
  let result = turndownService.turndown(cleaned);

  // Post-process: clean up excessive whitespace
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.trim();

  return result;
}

/**
 * Generate Obsidian frontmatter
 */
export function generateFrontmatter(data: {
  title: string;
  url: string;
  date?: Date;
  tags?: string[];
}): string {
  const date = data.date || new Date();
  const lines = [
    "---",
    `title: "${data.title.replace(/"/g, '\\"')}"`,
    `url: "${data.url}"`,
    `date: ${date.toISOString().split("T")[0]}`,
  ];

  if (data.tags && data.tags.length > 0) {
    lines.push(`tags: [${data.tags.map((t) => `"${t}"`).join(", ")}]`);
  }

  lines.push("---", "");

  return lines.join("\n");
}

/**
 * Extract domain from URL
 */
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Format date in various formats
 */
export function formatDate(
  date: Date,
  format: "date" | "time" | "datetime" | "year" | "month" | "day"
): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  switch (format) {
    case "date":
      return `${year}-${month}-${day}`;
    case "time":
      return `${hours}:${minutes}`;
    case "datetime":
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    case "year":
      return year.toString();
    case "month":
      return month;
    case "day":
      return day;
    default:
      return "";
  }
}

/**
 * Context for template variable resolution
 */
export interface TemplateContext {
  title: string;
  url: string;
  description?: string;
  author?: string;
  published?: string;
  selection?: string;
  content?: string;
  date?: Date;
  // YouTube-specific fields
  transcript?: string;
  videoId?: string;
  channel?: string;
  duration?: string;
}

/**
 * Resolve all template variables from context
 */
export function resolveTemplateVariables(
  context: TemplateContext
): Record<string, string> {
  const date = context.date || new Date();

  return {
    title: context.title,
    url: context.url,
    domain: getDomain(context.url),
    description: context.description || "",
    author: context.author || "",
    published: context.published || "",
    date: formatDate(date, "date"),
    time: formatDate(date, "time"),
    datetime: formatDate(date, "datetime"),
    year: formatDate(date, "year"),
    month: formatDate(date, "month"),
    day: formatDate(date, "day"),
    selection: context.selection || "",
    content: context.content || "",
    // YouTube-specific variables
    transcript: context.transcript || "",
    videoId: context.videoId || "",
    channel: context.channel || "",
    duration: context.duration || "",
  };
}

/**
 * Custom variable definition
 */
export interface CustomVariable {
  name: string;
  value: string;
}

/**
 * Replace template variables in a string
 * Supports {{variableName}} syntax
 */
export function replaceTemplateVariables(
  template: string,
  context: TemplateContext,
  customVariables: CustomVariable[] = []
): string {
  const builtInVariables = resolveTemplateVariables(context);

  // Merge custom variables (built-in takes precedence if same name)
  const customVarsMap: Record<string, string> = {};
  for (const cv of customVariables) {
    customVarsMap[cv.name] = cv.value;
  }

  const variables = { ...customVarsMap, ...builtInVariables };

  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    if (varName in variables) {
      return variables[varName];
    }
    return match; // Keep original if variable not found
  });
}

/**
 * Template property for Obsidian frontmatter
 */
export interface TemplateProperty {
  key: string;
  value: string;
  inputType?: string;
}

/**
 * Generate Obsidian frontmatter from template properties
 */
export function generateFrontmatterFromProperties(
  properties: TemplateProperty[],
  context: TemplateContext,
  customVariables: CustomVariable[] = []
): string {
  if (properties.length === 0) return "";

  const lines: string[] = ["---"];

  for (const prop of properties) {
    const value = replaceTemplateVariables(
      prop.value,
      context,
      customVariables
    );

    // Format based on input type
    switch (prop.inputType) {
      case "list":
        // Parse as array if it looks like one, otherwise single item
        if (value.startsWith("[") && value.endsWith("]")) {
          lines.push(`${prop.key}: ${value}`);
        } else if (value) {
          lines.push(`${prop.key}:`);
          lines.push(`  - "${escapeYamlString(value)}"`);
        } else {
          lines.push(`${prop.key}: []`);
        }
        break;

      case "tags":
        // Handle tags array
        if (value.startsWith("[") && value.endsWith("]")) {
          lines.push(`${prop.key}: ${value}`);
        } else if (value) {
          const tags = value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          if (tags.length > 0) {
            lines.push(
              `${prop.key}: [${tags.map((t) => `"${escapeYamlString(t)}"`).join(", ")}]`
            );
          } else {
            lines.push(`${prop.key}: []`);
          }
        } else {
          lines.push(`${prop.key}: []`);
        }
        break;

      case "checkbox":
        lines.push(
          `${prop.key}: ${value === "true" || value === "1" ? "true" : "false"}`
        );
        break;

      case "number": {
        const num = parseFloat(value);
        lines.push(`${prop.key}: ${isNaN(num) ? 0 : num}`);
        break;
      }

      case "date":
      case "datetime":
        // Keep date/datetime as-is (already formatted)
        lines.push(`${prop.key}: ${value || ""}`);
        break;

      default:
        // Text - quote if contains special chars
        if (
          value &&
          (value.includes(":") ||
            value.includes("#") ||
            value.includes("'") ||
            value.includes('"'))
        ) {
          lines.push(`${prop.key}: "${escapeYamlString(value)}"`);
        } else {
          lines.push(`${prop.key}: ${value}`);
        }
    }
  }

  lines.push("---");
  return lines.join("\n");
}

/**
 * Escape special characters for YAML strings
 */
function escapeYamlString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Process a template and generate note content
 */
export interface ProcessTemplateOptions {
  folder: string;
  filename: string;
  properties: TemplateProperty[];
  content: string;
  context: TemplateContext;
  customVariables?: CustomVariable[];
}

export interface ProcessedNote {
  folder: string;
  filename: string;
  content: string;
}

export function processTemplate(
  options: ProcessTemplateOptions
): ProcessedNote {
  const {
    folder,
    filename,
    properties,
    content,
    context,
    customVariables = [],
  } = options;

  // Process folder path
  const processedFolder = sanitizeFilename(
    replaceTemplateVariables(folder, context, customVariables)
  ).replace(/-+/g, "/"); // Allow path separators

  // Process filename
  const processedFilename = sanitizeFilename(
    replaceTemplateVariables(filename, context, customVariables)
  );

  // Generate frontmatter
  const frontmatter = generateFrontmatterFromProperties(
    properties,
    context,
    customVariables
  );

  // Process content
  const processedContent = replaceTemplateVariables(
    content,
    context,
    customVariables
  );

  // Combine frontmatter and content
  const fullContent = frontmatter
    ? `${frontmatter}\n\n${processedContent}`
    : processedContent;

  return {
    folder: processedFolder,
    filename: processedFilename,
    content: fullContent,
  };
}
