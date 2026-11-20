import type { Task } from "./types";
import { addDays, todayKey } from "./date";

/** Days on which at least one task was completed (by planned date). */
export function doneDays(tasks: Task[]): Set<string> {
  return new Set(tasks.filter((t) => t.completed).map((t) => t.date));
}

/** Current streak: consecutive days with ≥1 completed task, ending today (or yesterday if today is still open). */
export function currentStreak(tasks: Task[]): { count: number; litToday: boolean } {
  const days = doneDays(tasks);
  const today = todayKey();
  const litToday = days.has(today);
  let cursor = litToday ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return { count, litToday };
}

export function bestStreak(tasks: Task[]): number {
  const days = [...doneDays(tasks)].sort();
  let best = 0, run = 0, prev = "";
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
