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
 * Escape special characters for YAML strings
 */
export function escapeYamlString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
