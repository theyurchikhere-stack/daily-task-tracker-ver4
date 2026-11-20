import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const tasks = pgTable(
  "tasks",
  {
    id: serial().primaryKey(),
    // Anonymous per-device owner id generated in the browser
    deviceId: text("device_id").notNull(),
    title: text().notNull(),
    notes: text().notNull().default(""),
    // Planned day, YYYY-MM-DD (local date of the user)
    date: text().notNull(),
    // Optional time, HH:MM
    time: text(),
    category: text().notNull().default("personal"),
    priority: text().notNull().default("medium"),
    reminder: boolean().notNull().default(false),
    completed: boolean().notNull().default(false),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("tasks_device_date_idx").on(t.deviceId, t.date)],
);

// External calendars (e.g. iPhone/iCloud public calendar links) subscribed by a device
export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    id: serial().primaryKey(),
    deviceId: text("device_id").notNull(),
    name: text().notNull().default("Календарь iPhone"),
    // Normalised https:// URL of the .ics feed
    url: text().notNull(),
    color: text().notNull().default("#ff3b30"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("calendar_feeds_device_idx").on(t.deviceId)],
);
