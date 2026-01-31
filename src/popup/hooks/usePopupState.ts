import { useState, useEffect, useCallback } from "react";
import type { ClipTask } from "../../types/task";

export type ClipStatus = "idle" | "loading" | "success" | "error";
export type ConnectionStatus = "checking" | "connected" | "disconnected";

export interface TemplateSetInfo {
  id: string;
  name: string;
}

export interface PagePreview {
  title: string;
  url: string;
  domain: string;
  isYouTube: boolean;
  isClippable: boolean;
}

export function usePopupState(t: (key: string) => string) {
  const [status, setStatus] = useState<ClipStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [pagePreview, setPagePreview] = useState<PagePreview | null>(null);
  const [vaultConfigured, setVaultConfigured] = useState<boolean>(true);
  const [apiConfigured, setApiConfigured] = useState<boolean>(true);
  const [tasks, setTasks] = useState<ClipTask[]>([]);
  const [templateSets, setTemplateSets] = useState<TemplateSetInfo[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("checking");

  // Check Obsidian connection
  const checkConnection = useCallback(() => {
    setConnectionStatus("checking");
    try {
      chrome.runtime.sendMessage(
        { type: "CHECK_OBSIDIAN_CONNECTION" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[Web2Obsidian] Failed to check connection:",
              chrome.runtime.lastError
            );
            setConnectionStatus("disconnected");
            return;
          }
          setConnectionStatus(
            response?.connected ? "connected" : "disconnected"
          );
        }
      );
    } catch (error) {
      console.warn("[Web2Obsidian] Error checking connection:", error);
      setConnectionStatus("disconnected");
    }
  }, []);

  // Listen for task updates from background
  const handleTaskMessage = useCallback(
    (message: { type: string; task?: ClipTask }) => {
      if (message.type === "TASK_UPDATE" && message.task) {
        setTasks((prevTasks) => {
          const existingIndex = prevTasks.findIndex(
            (t) => t.id === message.task!.id
          );
          if (existingIndex >= 0) {
            const updated = [...prevTasks];
            updated[existingIndex] = message.task!;
            return updated;
          }
          return [message.task!, ...prevTasks].slice(0, 10);
        });
      }
    },
    []
  );

  // Load tasks from background
  const loadTasks = useCallback(() => {
    try {
      chrome.runtime.sendMessage({ type: "GET_TASKS" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Web2Obsidian] Failed to load tasks:",
            chrome.runtime.lastError
          );
          return;
        }
        if (response?.success && response.tasks) {
          setTasks(response.tasks);
        }
      });
    } catch (error) {
      console.warn("[Web2Obsidian] Error loading tasks:", error);
    }
  }, []);

  const checkConfiguration = useCallback(async () => {
    try {
      const syncResult = await chrome.storage.sync.get([
        "vaultName",
        "obsidianApiSettings",
      ]);
      setVaultConfigured(!!syncResult.vaultName);
      // REST API disabled means URI mode — no API key needed
      // Default is disabled (URI mode), so only require API key if explicitly enabled
      const apiEnabled = syncResult.obsidianApiSettings?.enabled === true;
      setApiConfigured(!apiEnabled || !!syncResult.obsidianApiSettings?.apiKey);

      const localResult = await chrome.storage.local.get(["templateSettings"]);
      if (localResult.templateSettings?.sets) {
        const sets: TemplateSetInfo[] = localResult.templateSettings.sets.map(
          (s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          })
        );
        setTemplateSets(sets);
        setSelectedSetId(
          localResult.templateSettings.defaultSetId || sets[0]?.id || ""
        );
      }
    } catch (error) {
      console.warn("[Web2Obsidian] Error checking configuration:", error);
    }
  }, []);

  const loadPageInfo = useCallback(() => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Web2Obsidian] Failed to query tabs:",
            chrome.runtime.lastError
          );
          return;
        }
        const tab = tabs[0];
        if (tab?.url && tab?.title) {
          try {
            const url = new URL(tab.url);
            const isYouTube =
              url.hostname.includes("youtube.com") && url.pathname === "/watch";
            const isPdf = url.pathname.toLowerCase().endsWith(".pdf");
            const isClippable =
              (url.protocol === "http:" || url.protocol === "https:") && !isPdf;

            setPagePreview({
              title: tab.title,
              url: tab.url,
              domain: url.hostname.replace(/^www\./, ""),
              isYouTube,
              isClippable,
            });
          } catch {
            setPagePreview(null);
          }
        }
      });
    } catch (error) {
      console.warn("[Web2Obsidian] Error loading page info:", error);
    }
  }, []);

  useEffect(() => {
    loadPageInfo();
    checkConfiguration();
    loadTasks();
    checkConnection();

    chrome.runtime.onMessage.addListener(handleTaskMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleTaskMessage);
    };
  }, [
    handleTaskMessage,
    loadTasks,
    checkConnection,
    checkConfiguration,
    loadPageInfo,
  ]);

  const handleClip = useCallback(() => {
    if (!vaultConfigured) {
      setErrorMessage(t("popup.vaultNotConfigured"));
      setStatus("error");
      return;
    }

    if (!apiConfigured) {
      setErrorMessage(t("popup.apiNotConfigured"));
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    chrome.runtime.sendMessage(
      { type: "CLIP_PAGE", data: { templateId: selectedSetId } },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus("error");
          setErrorMessage(
            chrome.runtime.lastError.message || t("popup.clipError")
          );
          return;
        }

        if (response?.success) {
          setStatus("idle");
        } else {
          setStatus("error");
          setErrorMessage(response?.error || t("popup.clipError"));
        }
      }
    );
  }, [vaultConfigured, apiConfigured, selectedSetId, t]);

  const handleOpenObsidian = useCallback(() => {
    chrome.runtime.sendMessage({ type: "OPEN_OBSIDIAN" }, () => {
      // After opening, wait a bit and check connection again
      setTimeout(() => {
        checkConnection();
      }, 3000);
    });
  }, [checkConnection]);

  const handleOpenSettings = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const handleCancelTask = useCallback((taskId: string) => {
    try {
      chrome.runtime.sendMessage(
        { type: "CANCEL_TASK", taskId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[Web2Obsidian] Failed to cancel task:",
              chrome.runtime.lastError
            );
          }
          if (response?.cancelled) {
            // Task update will arrive via TASK_UPDATE broadcast
            console.log("[Web2Obsidian] Task cancelled:", taskId);
          }
        }
      );
    } catch (error) {
      console.warn("[Web2Obsidian] Error cancelling task:", error);
    }
  }, []);

  const runningTasks = tasks.filter((t) => t.status === "running");
  const completedTasks = tasks.filter((t) => t.status !== "running");

  // Can clip only if connected and page is clippable
  const canClip =
    connectionStatus === "connected" &&
    pagePreview?.isClippable &&
    vaultConfigured &&
    apiConfigured &&
    status !== "loading";

  return {
    status,
    errorMessage,
    pagePreview,
    vaultConfigured,
    apiConfigured,
    tasks,
    templateSets,
    selectedSetId,
    setSelectedSetId,
    connectionStatus,
    runningTasks,
    completedTasks,
    canClip,
    handleClip,
    handleOpenObsidian,
    handleOpenSettings,
    handleCancelTask,
  };
}
