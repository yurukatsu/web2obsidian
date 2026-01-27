import type { ClipTask, TaskHistory, TaskStep } from "../types/task";
import { createDefaultTaskHistory } from "../types/task";

// Map of running task IDs to their AbortControllers for cancellation
const runningAbortControllers = new Map<string, AbortController>();

export function getAbortController(
  taskId: string
): AbortController | undefined {
  return runningAbortControllers.get(taskId);
}

export function setAbortController(
  taskId: string,
  controller: AbortController
): void {
  runningAbortControllers.set(taskId, controller);
}

export function deleteAbortController(taskId: string): void {
  runningAbortControllers.delete(taskId);
}

/**
 * Get task history from storage
 */
export async function getTaskHistory(): Promise<TaskHistory> {
  const { taskHistory } = await chrome.storage.local.get(["taskHistory"]);
  return taskHistory || createDefaultTaskHistory();
}

/**
 * Save task history to storage
 */
export async function saveTaskHistory(history: TaskHistory): Promise<void> {
  await chrome.storage.local.set({ taskHistory: history });
}

/**
 * Add or update a task in history
 */
export async function upsertTask(task: ClipTask): Promise<void> {
  const history = await getTaskHistory();
  const existingIndex = history.tasks.findIndex((t) => t.id === task.id);

  if (existingIndex >= 0) {
    history.tasks[existingIndex] = task;
  } else {
    // Add new task at the beginning
    history.tasks.unshift(task);
    // Keep only maxTasks
    if (history.tasks.length > history.maxTasks) {
      history.tasks = history.tasks.slice(0, history.maxTasks);
    }
  }

  await saveTaskHistory(history);
  // Broadcast update to popup
  broadcastTaskUpdate(task);
}

/**
 * Broadcast task update to all extension pages
 */
export function broadcastTaskUpdate(task: ClipTask): void {
  chrome.runtime
    .sendMessage({
      type: "TASK_UPDATE",
      task,
    })
    .catch(() => {
      // Popup might be closed, ignore the error
    });
}

/**
 * Update task step and broadcast
 */
export async function updateTaskStep(
  taskId: string,
  step: TaskStep
): Promise<void> {
  const history = await getTaskHistory();
  const task = history.tasks.find((t) => t.id === taskId);
  if (task) {
    task.step = step;
    await saveTaskHistory(history);
    broadcastTaskUpdate(task);
  }
}

/**
 * Mark task as completed
 */
export async function completeTask(
  taskId: string,
  result: { path: string }
): Promise<void> {
  const history = await getTaskHistory();
  const task = history.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "success";
    task.step = "done";
    task.completedAt = Date.now();
    task.result = result;
    await saveTaskHistory(history);
    broadcastTaskUpdate(task);
  }
}

/**
 * Mark task as failed
 */
export async function failTask(taskId: string, error: string): Promise<void> {
  const history = await getTaskHistory();
  const task = history.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = "error";
    task.completedAt = Date.now();
    task.error = error;
    await saveTaskHistory(history);
    broadcastTaskUpdate(task);
  }
}

/**
 * Cancel a running task
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  const controller = runningAbortControllers.get(taskId);
  if (controller) {
    controller.abort();
    runningAbortControllers.delete(taskId);
  }

  const history = await getTaskHistory();
  const task = history.tasks.find((t) => t.id === taskId);
  if (task && task.status === "running") {
    task.status = "cancelled";
    task.completedAt = Date.now();
    await saveTaskHistory(history);
    broadcastTaskUpdate(task);
    return true;
  }
  return false;
}
