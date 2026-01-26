import { CheckIcon } from "./icons";

export type StepStatus = "pending" | "active" | "completed";

interface ProgressStepProps {
  label: string;
  status: StepStatus;
}

export function ProgressStep({ label, status }: ProgressStepProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === "pending" && (
        <span className="h-4 w-4 rounded-full border-2 border-base-300"></span>
      )}
      {status === "active" && (
        <span className="loading loading-spinner loading-xs text-primary"></span>
      )}
      {status === "completed" && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success">
          <CheckIcon className="h-3 w-3 text-success-content" />
        </span>
      )}
      <span
        className={
          status === "active"
            ? "font-medium text-primary"
            : status === "completed"
              ? "text-base-content"
              : "text-base-content/50"
        }
      >
        {label}
      </span>
    </div>
  );
}
