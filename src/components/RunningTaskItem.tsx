import type { ClipTask, TaskStep } from "../types/task";
import { ProgressStep, StepStatus } from "./ProgressStep";

interface RunningTaskItemProps {
  task: ClipTask;
  t: (key: string) => string;
}

export function RunningTaskItem({ task, t }: RunningTaskItemProps) {
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
