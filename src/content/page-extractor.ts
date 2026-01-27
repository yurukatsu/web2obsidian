import Defuddle from "defuddle";
import { htmlToMarkdown } from "../utils/markdown";
import type { PageInfo } from "./types";

export function getPageInfo(): PageInfo {
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
