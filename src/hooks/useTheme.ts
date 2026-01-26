import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  // Initialize theme from storage or system preference
  useEffect(() => {
    const initTheme = async () => {
      // Try to get from chrome storage
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.sync.get(["theme"], (result) => {
          if (result.theme) {
            setTheme(result.theme);
            applyTheme(result.theme);
          } else {
            // Fall back to system preference
            const systemTheme = window.matchMedia(
              "(prefers-color-scheme: dark)"
            ).matches
              ? "dark"
              : "light";
            setTheme(systemTheme);
            applyTheme(systemTheme);
          }
        });
      } else {
        // Fall back to localStorage
        const stored = localStorage.getItem("theme") as Theme | null;
        const initialTheme =
          stored ||
          (window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light");
        setTheme(initialTheme);
        applyTheme(initialTheme);
      }
    };

    initTheme();
  }, []);

  const applyTheme = (newTheme: Theme) => {
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const changeTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    // Save to chrome storage for persistence
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.set({ theme: newTheme });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    changeTheme(newTheme);
  }, [theme, changeTheme]);

  return {
    theme,
    changeTheme,
    toggleTheme,
  };
}
