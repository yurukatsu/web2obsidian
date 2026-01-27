let toastContainer: HTMLDivElement | null = null;

export function showToast(
  message: string,
  type: "info" | "success" | "error" = "info"
): void {
  console.log("[Web2Obsidian] showToast called:", message, type);

  // Create container if it doesn't exist
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement("div");
    toastContainer.id = "web2obsidian-toast-container";
    toastContainer.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      pointer-events: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    `;
    document.body.appendChild(toastContainer);
    console.log("[Web2Obsidian] Toast container created");
  }

  // Create toast element
  const toast = document.createElement("div");
  const bgColor =
    type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#3b82f6";
  toast.style.cssText = `
    background: ${bgColor} !important;
    color: white !important;
    padding: 12px 16px !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    pointer-events: auto !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
  `;

  // Add icon
  const icon = type === "error" ? "✕" : type === "success" ? "✓" : "⟳";
  toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><span>${message}</span>`;

  toastContainer.appendChild(toast);
  console.log("[Web2Obsidian] Toast element added to container");

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.remove();
    console.log("[Web2Obsidian] Toast removed");
  }, 3000);
}
