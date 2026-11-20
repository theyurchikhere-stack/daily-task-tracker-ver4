import type { CalendarFeed, ExternalEventRaw, Task, TaskDraft } from "./types";

const KEY = "ogonek-device-id";

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function setDeviceId(id: string) {
  localStorage.setItem(KEY, id.trim());
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", "x-device-id": getDeviceId(), ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Ошибка ${res.status}`);
  return data as T;
}

export const api = {
  list: () => request<Task[]>("/api/tasks"),
  create: (draft: TaskDraft) => request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(draft) }),
  update: (id: number, patch: Partial<Task>) =>
    request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: number) => request<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),

  calendars: () => request<CalendarFeed[]>("/api/calendars"),
  addCalendar: (url: string, name?: string, color?: string) =>
    request<CalendarFeed>("/api/calendars", { method: "POST", body: JSON.stringify({ url, name, color }) }),
  removeCalendar: (id: number) => request<{ ok: true }>(`/api/calendars/${id}`, { method: "DELETE" }),
  calendarEvents: (from: string, to: string, fresh = false) =>
    request<{ events: ExternalEventRaw[]; errors: { feedId: number; error: string }[] }>(
      `/api/calendar-events?from=${from}&to=${to}${fresh ? "&fresh=1" : ""}`,
    ),
};

/** Address of the always-up-to-date .ics subscription with this device's tasks. */
export function taskFeedUrl(protocol: "webcal" | "https" = "webcal") {
  return `${protocol}://${location.host}/api/feed/${getDeviceId()}.ics`;
}
