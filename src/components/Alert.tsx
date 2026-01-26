import { ReactNode } from "react";
import { WarningIcon, ErrorCircleIcon } from "./icons";

type AlertVariant = "warning" | "error" | "info" | "success";

interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
  className?: string;
}

const iconMap: Record<AlertVariant, ReactNode> = {
  warning: <WarningIcon />,
  error: <ErrorCircleIcon />,
  info: <ErrorCircleIcon />,
  success: <ErrorCircleIcon />,
};

export function Alert({ variant, children, className = "" }: AlertProps) {
  return (
    <div className={`alert alert-${variant} ${className}`}>
      {iconMap[variant]}
      <span className="text-sm">{children}</span>
    </div>
  );
}
