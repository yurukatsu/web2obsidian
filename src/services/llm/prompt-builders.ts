/**
 * Build the system prompt for content formatting
 */
export function buildSystemPrompt(userPrompt: string): string {
  const defaultPrompt = `You are a helpful assistant that cleans and formats web content for note-taking.
Your task is to:
1. Remove any remaining noise (navigation elements, ads, related articles, author bios, etc.)
2. Clean up formatting issues
3. Preserve the main article content and structure
4. Keep headings, lists, code blocks, and links intact
5. Output clean Markdown

Return ONLY the cleaned content, no explanations or additional text.`;

  return userPrompt || defaultPrompt;
}

/**
 * Build the user message based on operation mode
 */
export function buildUserMessage(
  content: string,
  mode?: "format" | "tags"
): string {
  if (mode === "tags") {
    return `Please analyze the following content and generate tags:\n\n${content}`;
  }
  return `Please process the following content:\n\n${content}`;
}
