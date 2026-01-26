import { describe, it, expect } from "vitest";
import {
  isYouTubeVideo,
  getYouTubeVideoId,
  sanitizeFilename,
  generateFrontmatter,
  getDomain,
  formatDate,
  resolveTemplateVariables,
  replaceTemplateVariables,
} from "./index";

describe("isYouTubeVideo", () => {
  it("should return true for YouTube video URLs", () => {
    expect(isYouTubeVideo("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYouTubeVideo("https://youtube.com/watch?v=abc123")).toBe(true);
  });

  it("should return false for non-YouTube URLs", () => {
    expect(isYouTubeVideo("https://www.google.com")).toBe(false);
    expect(isYouTubeVideo("https://example.com/watch?v=abc123")).toBe(false);
  });

  it("should return false for YouTube non-video pages", () => {
    expect(isYouTubeVideo("https://www.youtube.com/channel/abc")).toBe(false);
    expect(isYouTubeVideo("https://www.youtube.com/")).toBe(false);
  });

  it("should return false for invalid URLs", () => {
    expect(isYouTubeVideo("not-a-url")).toBe(false);
  });
});

describe("getYouTubeVideoId", () => {
  it("should extract video ID from standard YouTube URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=abc123")).toBe(
      "abc123"
    );
  });

  it("should extract video ID from youtu.be URL", () => {
    expect(getYouTubeVideoId("https://youtu.be/abc123")).toBe("abc123");
  });

  it("should return null for non-YouTube URLs", () => {
    expect(getYouTubeVideoId("https://example.com")).toBe(null);
  });

  it("should return null for invalid URLs", () => {
    expect(getYouTubeVideoId("not-a-url")).toBe(null);
  });
});

describe("sanitizeFilename", () => {
  it("should remove invalid characters", () => {
    expect(sanitizeFilename('test:file*name?.md"')).toBe("test-file-name-.md-");
  });

  it("should normalize whitespace", () => {
    expect(sanitizeFilename("test   file  name")).toBe("test file name");
  });

  it("should limit length to 200 characters", () => {
    const longName = "a".repeat(250);
    expect(sanitizeFilename(longName).length).toBe(200);
  });
});

describe("generateFrontmatter", () => {
  it("should generate valid frontmatter", () => {
    const result = generateFrontmatter({
      title: "Test Title",
      url: "https://example.com",
      date: new Date("2024-01-15"),
    });

    expect(result).toContain("---");
    expect(result).toContain('title: "Test Title"');
    expect(result).toContain('url: "https://example.com"');
    expect(result).toContain("date: 2024-01-15");
  });

  it("should include tags when provided", () => {
    const result = generateFrontmatter({
      title: "Test",
      url: "https://example.com",
      tags: ["tag1", "tag2"],
    });

    expect(result).toContain('tags: ["tag1", "tag2"]');
  });

  it("should escape quotes in title", () => {
    const result = generateFrontmatter({
      title: 'Title with "quotes"',
      url: "https://example.com",
    });

    expect(result).toContain('title: "Title with \\"quotes\\""');
  });
});

describe("getDomain", () => {
  it("should extract domain from URL", () => {
    expect(getDomain("https://www.example.com/page")).toBe("example.com");
    expect(getDomain("https://example.com/page")).toBe("example.com");
  });

  it("should handle subdomains", () => {
    expect(getDomain("https://blog.example.com/post")).toBe("blog.example.com");
  });

  it("should return empty string for invalid URLs", () => {
    expect(getDomain("not-a-url")).toBe("");
  });
});

describe("formatDate", () => {
  const testDate = new Date("2024-03-15T14:30:00");

  it("should format date correctly", () => {
    expect(formatDate(testDate, "date")).toBe("2024-03-15");
  });

  it("should format time correctly", () => {
    expect(formatDate(testDate, "time")).toBe("14:30");
  });

  it("should format datetime correctly", () => {
    expect(formatDate(testDate, "datetime")).toBe("2024-03-15 14:30");
  });

  it("should format year correctly", () => {
    expect(formatDate(testDate, "year")).toBe("2024");
  });

  it("should format month correctly", () => {
    expect(formatDate(testDate, "month")).toBe("03");
  });

  it("should format day correctly", () => {
    expect(formatDate(testDate, "day")).toBe("15");
  });
});

describe("resolveTemplateVariables", () => {
  it("should resolve all built-in variables", () => {
    const context = {
      title: "Test Page",
      url: "https://www.example.com/path",
      description: "A test page description",
      author: "John Doe",
      published: "2024-01-10",
      selection: "selected text",
      content: "page content",
      date: new Date("2024-03-15T14:30:00"),
    };

    const vars = resolveTemplateVariables(context);

    expect(vars.title).toBe("Test Page");
    expect(vars.url).toBe("https://www.example.com/path");
    expect(vars.domain).toBe("example.com");
    expect(vars.description).toBe("A test page description");
    expect(vars.author).toBe("John Doe");
    expect(vars.published).toBe("2024-01-10");
    expect(vars.date).toBe("2024-03-15");
    expect(vars.time).toBe("14:30");
    expect(vars.datetime).toBe("2024-03-15 14:30");
    expect(vars.year).toBe("2024");
    expect(vars.month).toBe("03");
    expect(vars.day).toBe("15");
    expect(vars.selection).toBe("selected text");
    expect(vars.content).toBe("page content");
  });

  it("should handle missing optional fields", () => {
    const context = {
      title: "Test",
      url: "https://example.com",
    };

    const vars = resolveTemplateVariables(context);

    expect(vars.description).toBe("");
    expect(vars.author).toBe("");
    expect(vars.published).toBe("");
    expect(vars.selection).toBe("");
    expect(vars.content).toBe("");
  });
});

describe("replaceTemplateVariables", () => {
  const context = {
    title: "Test Page",
    url: "https://www.example.com/path",
    date: new Date("2024-03-15T14:30:00"),
  };

  it("should replace single variable", () => {
    expect(replaceTemplateVariables("{{title}}", context)).toBe("Test Page");
  });

  it("should replace multiple variables", () => {
    expect(
      replaceTemplateVariables("Clippings/{{domain}}/{{date}}", context)
    ).toBe("Clippings/example.com/2024-03-15");
  });

  it("should keep unknown variables unchanged", () => {
    expect(replaceTemplateVariables("{{unknown}}", context)).toBe(
      "{{unknown}}"
    );
  });

  it("should handle mixed content", () => {
    expect(
      replaceTemplateVariables("Title: {{title}} ({{year}})", context)
    ).toBe("Title: Test Page (2024)");
  });

  it("should handle no variables", () => {
    expect(replaceTemplateVariables("No variables here", context)).toBe(
      "No variables here"
    );
  });

  it("should replace custom variables", () => {
    const customVars = [
      { name: "project", value: "MyProject" },
      { name: "category", value: "Tech" },
    ];
    expect(
      replaceTemplateVariables(
        "{{project}}/{{category}}/{{title}}",
        context,
        customVars
      )
    ).toBe("MyProject/Tech/Test Page");
  });

  it("should prioritize built-in variables over custom variables", () => {
    const customVars = [{ name: "title", value: "CustomTitle" }];
    expect(replaceTemplateVariables("{{title}}", context, customVars)).toBe(
      "Test Page"
    );
  });
});
