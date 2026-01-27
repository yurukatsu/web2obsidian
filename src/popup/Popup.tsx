import { useTranslation } from "react-i18next";
import {
  ThemeToggle,
  LanguageToggle,
  Alert,
  GearIcon,
  TaskItem,
  RunningTaskItem,
} from "@components/index";
import { usePopupState } from "./hooks/usePopupState";

export function Popup() {
  const { t } = useTranslation();
  const {
    status,
    errorMessage,
    pagePreview,
    vaultConfigured,
    apiConfigured,
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
  } = usePopupState(t);

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
                <RunningTaskItem
                  key={task.id}
                  task={task}
                  t={t}
                  onCancel={handleCancelTask}
                />
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
