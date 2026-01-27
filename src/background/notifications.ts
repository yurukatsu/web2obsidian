/**
 * Show a browser notification
 */
export async function showNotification(
  notificationId: string,
  message: string,
  type: "success" | "error"
): Promise<void> {
  try {
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "Web2Obsidian",
      message,
      priority: type === "error" ? 2 : 1,
    });

    // Auto-clear after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 5000);
  } catch (error) {
    console.warn("[Web2Obsidian] Failed to show notification:", error);
  }
}
