export interface ClipPageMessage {
  type: "CLIP_PAGE";
  data?: {
    templateId?: string;
  };
}

export interface GetPageInfoMessage {
  type: "GET_PAGE_INFO";
}

export interface GetTasksMessage {
  type: "GET_TASKS";
}

export interface CheckConnectionMessage {
  type: "CHECK_OBSIDIAN_CONNECTION";
}

export interface OpenObsidianMessage {
  type: "OPEN_OBSIDIAN";
}

export interface ClipWithConnectionCheckMessage {
  type: "CLIP_WITH_CONNECTION_CHECK";
  data?: {
    templateId?: string;
  };
}

export interface CancelTaskMessage {
  type: "CANCEL_TASK";
  taskId: string;
}

export type Message =
  | ClipPageMessage
  | GetPageInfoMessage
  | GetTasksMessage
  | CheckConnectionMessage
  | OpenObsidianMessage
  | ClipWithConnectionCheckMessage
  | CancelTaskMessage
  | { type: string; data?: unknown };
