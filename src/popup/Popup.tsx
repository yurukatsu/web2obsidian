import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ThemeToggle,
  LanguageToggle,
  Alert,
  GearIcon,
  TaskItem,
  RunningTaskItem,
} from "@components/index";
import type { ClipTask } from "../types/task";

type ClipStatus = "idle" | "loading" | "success" | "error";
type ConnectionStatus = "checking" | "connected" | "disconnected";

// Simplified template set interface for popup
interface TemplateSetInfo {
  id: string;
  name: string;
}

interface PagePreview {
  title: string;
  url: string;
  domain: string;
  isYouTube: boolean;
  isClippable: boolean;
}

export function Popup() {
  const { t } = useTranslation();
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

  useEffect(() => {
    loadPageInfo();
    checkConfiguration();
    loadTasks();
    checkConnection();

    chrome.runtime.onMessage.addListener(handleTaskMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleTaskMessage);
    };
  }, [handleTaskMessage, loadTasks, checkConnection]);

  const checkConfiguration = async () => {
    try {
      const syncResult = await chrome.storage.sync.get([
        "vaultName",
        "obsidianApiSettings",
      ]);
      setVaultConfigured(!!syncResult.vaultName);
      setApiConfigured(!!syncResult.obsidianApiSettings?.apiKey);

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
  };

  const loadPageInfo = () => {
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
  };

  const handleClip = () => {
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
  };

  const handleOpenObsidian = () => {
    chrome.runtime.sendMessage({ type: "OPEN_OBSIDIAN" }, () => {
      // After opening, wait a bit and check connection again
      setTimeout(() => {
        checkConnection();
      }, 3000);
    });
  };

  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const runningTasks = tasks.filter((t) => t.status === "running");
  const completedTasks = tasks.filter((t) => t.status !== "running");

  // Can clip only if connected and page is clippable
  const canClip =
    connectionStatus === "connected" &&
    pagePreview?.isClippable &&
    vaultConfigured &&
    apiConfigured &&
    status !== "loading";

  return (
    <div className="flex max-h-[500px] min-h-[300px] w-[360px] flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{t("popup.title")}</h1>
          {/* Connection Status Indicator */}
          {apiConfigured && (
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                connectionStatus === "checking"
                  ? "animate-pulse bg-warning"
                  : connectionStatus === "connected"
                    ? "bg-success"
                    : "bg-error"
              }`}
              title={
                connectionStatus === "checking"
                  ? t("popup.connectionChecking")
                  : connectionStatus === "connected"
                    ? t("popup.connectionConnected")
                    : t("popup.connectionDisconnected")
              }
            />
          )}
        </div>
        <div className="flex gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <button
            className="btn btn-circle btn-ghost btn-sm"
            onClick={handleOpenSettings}
            title={t("popup.openSettings")}
          >
            <GearIcon />
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Page Preview */}
        {pagePreview && (
          <div className="card mb-4 bg-base-200">
            <div className="card-body p-3">
              <div className="flex items-start gap-2">
                {pagePreview.isYouTube ? (
                  <span className="badge badge-error badge-sm">YouTube</span>
                ) : (
                  <span className="badge badge-info badge-sm">Web</span>
                )}
                <div className="min-w-0 flex-1">
                  <h2
                    className="truncate text-sm font-medium"
                    title={pagePreview.title}
                  >
                    {pagePreview.title}
                  </h2>
                  <p className="truncate text-xs text-base-content/60">
                    {pagePreview.domain}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Connection Warning - show when disconnected */}
        {apiConfigured && connectionStatus === "disconnected" && (
          <div className="alert alert-warning mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <span className="text-sm">
                {t("popup.connectionDisconnected")}
              </span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleOpenObsidian}
            >
              {t("popup.openObsidian")}
            </button>
          </div>
        )}

        {/* Running Tasks Progress */}
        {runningTasks.length > 0 && (
          <div className="mb-4">
            <h2 className="mb-2 text-sm font-semibold">
              {runningTasks.length === 1
                ? t("popup.runningTask")
                : `${t("popup.runningTasks")} (${runningTasks.length})`}
            </h2>
            <div className="max-h-[200px] overflow-y-auto">
              {runningTasks.map((task) => (
                <RunningTaskItem key={task.id} task={task} t={t} />
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {status === "error" && (
          <Alert variant="error" className="mb-4">
            {errorMessage}
          </Alert>
        )}

        {/* Configuration Warnings */}
        {!vaultConfigured && (
          <Alert variant="warning" className="mb-4">
            {t("popup.vaultNotConfigured")}
          </Alert>
        )}

        {vaultConfigured && !apiConfigured && (
          <Alert variant="warning" className="mb-4">
            {t("popup.apiNotConfigured")}
          </Alert>
        )}

        {/* Non-clippable page warning */}
        {pagePreview && !pagePreview.isClippable && (
          <Alert variant="warning" className="mb-4">
            {t("popup.notClippable")}
          </Alert>
        )}

        {/* Task History */}
        {completedTasks.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold">
              {t("popup.recentTasks")}
            </h2>
            <div className="space-y-2">
              {completedTasks.slice(0, 5).map((task) => (
                <TaskItem key={task.id} task={task} t={t} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="space-y-3 p-4 pt-0">
        {/* Template Set Selection */}
        {templateSets.length > 1 && (
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-sm">
                {t("popup.templateSet")}
              </span>
            </label>
            <select
              className="select select-bordered select-sm w-full"
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(e.target.value)}
              disabled={status === "loading"}
            >
              {templateSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Button */}
        <button
          className="btn btn-primary w-full"
          onClick={handleClip}
          disabled={!canClip}
        >
          {status === "loading" ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              {t("popup.processing")}
            </>
          ) : (
            t("popup.captureButton")
          )}
        </button>
      </div>
    </div>
  );
}
