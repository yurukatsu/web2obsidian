// Obsidian Local REST API Service
// https://github.com/coddingtonbear/obsidian-local-rest-api

export interface ObsidianApiSettings {
  apiKey: string;
  port: number;
  insecureMode: boolean; // Use HTTP instead of HTTPS (not recommended)
}

// Default ports for Local REST API plugin
export const OBSIDIAN_API_HTTPS_PORT = 27124;
export const OBSIDIAN_API_HTTP_PORT = 27123;

export function createDefaultObsidianApiSettings(): ObsidianApiSettings {
  return {
    apiKey: "",
    port: OBSIDIAN_API_HTTPS_PORT, // Default to HTTPS port
    insecureMode: false,
  };
}

export interface SaveToObsidianParams {
  folder: string;
  filename: string;
  content: string;
  settings: ObsidianApiSettings;
}

export interface ObsidianApiResponse {
  success: boolean;
  error?: string;
  path?: string;
  notRunning?: boolean; // True if Obsidian is not running
}

/**
 * Get the base URL for the Obsidian Local REST API
 */
function getBaseUrl(settings: ObsidianApiSettings): string {
  const protocol = settings.insecureMode ? "http" : "https";
  return `${protocol}://127.0.0.1:${settings.port}`;
}

/**
 * Save a note to Obsidian using the Local REST API
 */
export async function saveToObsidian(
  params: SaveToObsidianParams
): Promise<ObsidianApiResponse> {
  const { folder, filename, content, settings } = params;

  if (!settings.apiKey) {
    return { success: false, error: "API key is not configured" };
  }

  // Construct the file path (ensure .md extension)
  const filenameWithExt = filename.endsWith(".md")
    ? filename
    : `${filename}.md`;
  const filePath = folder ? `${folder}/${filenameWithExt}` : filenameWithExt;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");

  const baseUrl = getBaseUrl(settings);
  const url = `${baseUrl}/vault/${encodedPath}`;

  console.log("[Web2Obsidian] Saving to Obsidian API:", url);

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "text/markdown",
      },
      body: content,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[Web2Obsidian] Obsidian API error:",
        response.status,
        errorText
      );

      if (response.status === 401) {
        return { success: false, error: "Invalid API key" };
      }
      if (response.status === 404) {
        return {
          success: false,
          error: "Obsidian Local REST API not found. Is the plugin running?",
        };
      }

      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    console.log("[Web2Obsidian] Successfully saved to Obsidian");
    return { success: true, path: filePath };
  } catch (error) {
    console.error("[Web2Obsidian] Failed to save to Obsidian:", error);

    // Handle connection errors (Obsidian not running)
    if (
      error instanceof TypeError ||
      (error instanceof Error && error.message.includes("Failed to fetch"))
    ) {
      return {
        success: false,
        error:
          "Cannot connect to Obsidian. Is Obsidian running with Local REST API plugin?",
        notRunning: true,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Open Obsidian vault using obsidian:// URI scheme
 */
export function openObsidianVault(vaultName?: string): void {
  const uri = vaultName
    ? `obsidian://open?vault=${encodeURIComponent(vaultName)}`
    : "obsidian://open";

  // Create a temporary link and click it to open the URI
  const link = document.createElement("a");
  link.href = uri;
  link.click();
}

/**
 * Open Obsidian vault from service worker (no DOM access)
 */
export async function openObsidianVaultFromServiceWorker(
  vaultName?: string
): Promise<void> {
  const uri = vaultName
    ? `obsidian://open?vault=${encodeURIComponent(vaultName)}`
    : "obsidian://open";

  // Use chrome.tabs.create to open the URI
  await chrome.tabs.create({ url: uri, active: false });
}

/**
 * Test the connection to Obsidian Local REST API
 */
export async function testObsidianConnection(
  settings: ObsidianApiSettings
): Promise<ObsidianApiResponse> {
  if (!settings.apiKey) {
    return { success: false, error: "API key is not configured" };
  }

  const baseUrl = getBaseUrl(settings);
  const url = `${baseUrl}/`;

  console.log("[Web2Obsidian] Testing Obsidian API connection:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "Invalid API key" };
      }
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    console.log("[Web2Obsidian] Obsidian API connection successful:", data);

    return { success: true };
  } catch (error) {
    console.error("[Web2Obsidian] Obsidian API connection failed:", error);

    return {
      success: false,
      error:
        "Cannot connect to Obsidian. Is Obsidian running with Local REST API plugin?",
    };
  }
}

/**
 * Check if Obsidian API is configured
 */
export function isObsidianApiConfigured(
  settings: ObsidianApiSettings
): boolean {
  return !!settings.apiKey;
}
