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
