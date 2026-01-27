import { getDomain } from "./url";
import { formatDate } from "./date";
import { sanitizeFilename } from "./filename";
import { escapeYamlString } from "./frontmatter";

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
