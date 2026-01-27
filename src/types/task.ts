// Task management types for background processing

export type TaskStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "cancelled";
export type TaskStep =
  | "extracting"
  | "llm_content"
  | "llm_tags"
  | "saving"
  | "done";

export interface TaskPageInfo {
  title: string;
  url: string;
  domain: string;
  isYouTube: boolean;
}

export interface ClipTask {
  id: string;
  status: TaskStatus;
  step: TaskStep | null;
  pageInfo: TaskPageInfo;
  templateName: string;
  createdAt: number;
  completedAt?: number;
  result?: {
    path: string;
  };
  error?: string;
  // LLM settings for progress display
  llmEnabled: {
    content: boolean;
    tags: boolean;
  };
}

export interface TaskHistory {
  tasks: ClipTask[];
  maxTasks: number;
}

export function createDefaultTaskHistory(): TaskHistory {
  return {
    tasks: [],
    maxTasks: 10,
  };
}

export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
