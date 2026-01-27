import type { ClipTask, TaskStep } from "../types/task";
import { ProgressStep, StepStatus } from "./ProgressStep";

interface RunningTaskItemProps {
  task: ClipTask;
  t: (key: string) => string;
  onCancel: (taskId: string) => void;
}

export function RunningTaskItem({ task, t, onCancel }: RunningTaskItemProps) {
  const getStepStatus = (step: TaskStep): StepStatus => {
    if (!task.step) return "pending";

    const stepOrder: TaskStep[] = [
      "extracting",
      "llm_content",
      "llm_tags",
      "saving",
      "done",
    ];
    // Filter out disabled steps
    const activeSteps = stepOrder.filter((s) => {
      if (s === "llm_content" && !task.llmEnabled.content) return false;
      if (s === "llm_tags" && !task.llmEnabled.tags) return false;
      return true;
    });

    const currentIndex = activeSteps.indexOf(task.step);
    const stepIndex = activeSteps.indexOf(step);

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <div className="card mb-2 bg-base-200">
      <div className="card-body p-3">
        <div className="mb-3 flex items-start gap-2">
          {task.pageInfo.isYouTube ? (
            <span className="badge badge-error badge-sm">YouTube</span>
          ) : (
            <span className="badge badge-info badge-sm">Web</span>
          )}
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-sm font-medium"
              title={task.pageInfo.title}
            >
              {task.pageInfo.title}
            </h3>
            <p className="truncate text-xs text-base-content/60">
              {task.pageInfo.domain}
            </p>
          </div>
          <button
            className="btn btn-ghost btn-xs shrink-0"
            onClick={() => onCancel(task.id)}
            title={t("popup.cancelTask")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          <ProgressStep
            label={t("popup.progress.extracting")}
            status={getStepStatus("extracting")}
          />
          {task.llmEnabled.content && (
            <ProgressStep
              label={t("popup.progress.llmContent")}
              status={getStepStatus("llm_content")}
            />
          )}
          {task.llmEnabled.tags && (
            <ProgressStep
              label={t("popup.progress.llmTags")}
              status={getStepStatus("llm_tags")}
            />
          )}
          <ProgressStep
            label={t("popup.progress.saving")}
            status={getStepStatus("saving")}
          />
        </div>
      </div>
    </div>
  );
}
