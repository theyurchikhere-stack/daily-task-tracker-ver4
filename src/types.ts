export type Category = "work" | "personal" | "health" | "study" | "home";
export type Priority = "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  notes: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  category: Category;
  priority: Priority;
  reminder: boolean;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export type TaskDraft = Pick<Task, "title" | "notes" | "date" | "time" | "category" | "priority" | "reminder">;

export const CATEGORIES: Record<Category, { label: string; color: string; emoji: string }> = {
  work: { label: "Работа", color: "#5b8cff", emoji: "💼" },
  personal: { label: "Личное", color: "#c77dff", emoji: "✨" },
  health: { label: "Здоровье", color: "#3ddc97", emoji: "💪" },
  study: { label: "Учёба", color: "#ffc857", emoji: "📚" },
  home: { label: "Дом", color: "#ff8fab", emoji: "🏠" },
};

export const PRIORITIES: Record<Priority, { label: string }> = {
  low: { label: "Низкий" },
  medium: { label: "Средний" },
  high: { label: "Высокий" },
};

/** An iPhone / iCloud calendar connected by link (read-only). */
export interface CalendarFeed {
  id: number;
  name: string;
  color: string;
  host: string;
  createdAt: string;
}

/** Raw occurrence as returned by the server. */
export interface ExternalEventRaw {
  uid: string;
  feedId: number;
  title: string;
  location: string;
  notes: string;
  allDay: boolean;
  start: string;
  end: string;
  floating: boolean;
}

/** Occurrence placed on a local day, ready for display. */
export interface DayEvent {
  key: string;
  feedId: number;
  title: string;
  location: string;
  notes: string;
  date: string; // YYYY-MM-DD local
  time: string | null; // HH:MM local, null for all-day
  endTime: string | null;
  color: string;
  calendar: string;
}
