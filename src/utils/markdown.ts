import TurndownService from "turndown";

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
