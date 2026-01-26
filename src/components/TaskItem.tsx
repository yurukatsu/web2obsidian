import type { ClipTask, TaskStep } from "../types/task";
import { CheckIcon, XIcon } from "./icons";

interface TaskItemProps {
  task: ClipTask;
  t: (key: string) => string;
}

export function TaskItem({ task, t }: TaskItemProps) {
  const getStepLabel = (step: TaskStep | null): string => {
    if (!step) return "";
    const stepLabels: Record<TaskStep, string> = {
      extracting: t("popup.progress.extracting"),
      llm_content: t("popup.progress.llmContent"),
      llm_tags: t("popup.progress.llmTags"),
      saving: t("popup.progress.saving"),
      done: t("popup.progress.done"),
    };
    return stepLabels[step] || step;
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="card mb-2 bg-base-200">
      <div className="card-body p-3">
        <div className="flex items-start gap-2">
          {/* Status indicator */}
          {task.status === "running" && (
            <span className="loading loading-spinner loading-xs mt-1 text-primary"></span>
          )}
          {task.status === "success" && (
            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success">
              <CheckIcon className="h-3 w-3 text-success-content" />
            </span>
          )}
          {task.status === "error" && (
            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-error">
              <XIcon className="h-3 w-3 text-error-content" />
            </span>
          )}
          {task.status === "pending" && (
            <span className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-base-300"></span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {task.pageInfo.isYouTube ? (
                <span className="badge badge-error badge-xs">YT</span>
              ) : (
                <span className="badge badge-info badge-xs">Web</span>
              )}
              <span className="text-xs text-base-content/60">
                {formatTime(task.createdAt)}
              </span>
            </div>
            <h3
              className="mt-1 truncate text-sm font-medium"
              title={task.pageInfo.title}
            >
              {task.pageInfo.title}
            </h3>
            <p className="truncate text-xs text-base-content/60">
              {task.pageInfo.domain}
            </p>

            {/* Progress for running task */}
            {task.status === "running" && task.step && (
              <p className="mt-1 text-xs text-primary">
                {getStepLabel(task.step)}
              </p>
            )}

            {/* Error message */}
            {task.status === "error" && task.error && (
              <p
                className="mt-1 truncate text-xs text-error"
                title={task.error}
              >
                {task.error}
              </p>
            )}

            {/* Success path */}
            {task.status === "success" && task.result?.path && (
              <p
                className="mt-1 truncate text-xs text-success"
                title={task.result.path}
              >
                {task.result.path}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
