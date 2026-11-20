import { Hono } from "hono";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { calendarFeeds, tasks } from "../../db/schema.js";
import { calendarName, expandEvents, fetchFeed, normalizeFeedUrl, type ExternalEvent } from "./calendar.js";
import { buildTaskFeed } from "./ics.js";

const app = new Hono();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const CATEGORIES = ["work", "personal", "health", "study", "home"];
const PRIORITIES = ["low", "medium", "high"];

const DEVICE_RE = /^[a-zA-Z0-9-]{8,64}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function deviceIdOf(c: { req: { header(name: string): string | undefined } }) {
  const id = c.req.header("x-device-id") ?? "";
  return DEVICE_RE.test(id) ? id : null;
}

type TaskInput = Partial<{
  title: string;
  notes: string;
  date: string;
  time: string | null;
  category: string;
  priority: string;
  reminder: boolean;
  completed: boolean;
}>;

function clean(body: TaskInput, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = String(body.title).trim().slice(0, 200);
    if (!t) return { error: "Название задачи обязательно" };
    out.title = t;
  } else if (!partial) return { error: "Название задачи обязательно" };

  if (body.notes !== undefined) out.notes = String(body.notes).slice(0, 2000);
  if (body.date !== undefined) {
    if (!DATE_RE.test(body.date)) return { error: "Неверная дата" };
    out.date = body.date;
  } else if (!partial) return { error: "Дата обязательна" };
  if (body.time !== undefined) {
    if (body.time === null || body.time === "") out.time = null;
    else if (!TIME_RE.test(body.time)) return { error: "Неверное время" };
    else out.time = body.time;
  }
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return { error: "Неверная категория" };
    out.category = body.category;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) return { error: "Неверный приоритет" };
    out.priority = body.priority;
  }
  if (body.reminder !== undefined) out.reminder = Boolean(body.reminder);
  if (body.completed !== undefined) {
    out.completed = Boolean(body.completed);
    out.completedAt = body.completed ? new Date() : null;
  }
  return { data: out };
}

app.get("/api/tasks", async (c) => {
  const deviceId = deviceIdOf(c);
  if (!deviceId) return c.json({ error: "Missing device id" }, 400);
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.deviceId, deviceId))
    .orderBy(asc(tasks.date), asc(tasks.time), asc(tasks.id));
  return c.json(rows);
});

app.post("/api/tasks", async (c) => {
  const deviceId = deviceIdOf(c);
  if (!deviceId) return c.json({ error: "Missing device id" }, 400);
  const body = (await c.req.json().catch(() => ({}))) as TaskInput;
  const result = clean(body, false);
  if ("error" in result) return c.json({ error: result.error }, 400);
  const [row] = await db
    .insert(tasks)
    .values({ ...(result.data as typeof tasks.$inferInsert), deviceId })
    .returning();
  return c.json(row, 201);
});

app.patch("/api/tasks/:id", async (c) => {
  const deviceId = deviceIdOf(c);
  const id = Number(c.req.param("id"));
  if (!deviceId || !Number.isInteger(id)) return c.json({ error: "Bad request" }, 400);
  const body = (await c.req.json().catch(() => ({}))) as TaskInput;
  const result = clean(body, true);
  if ("error" in result) return c.json({ error: result.error }, 400);
  if (Object.keys(result.data).length === 0) return c.json({ error: "Nothing to update" }, 400);
  const [row] = await db
    .update(tasks)
    .set(result.data as Partial<typeof tasks.$inferInsert>)
    .where(and(eq(tasks.id, id), eq(tasks.deviceId, deviceId)))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

app.delete("/api/tasks/:id", async (c) => {
  const deviceId = deviceIdOf(c);
  const id = Number(c.req.param("id"));
  if (!deviceId || !Number.isInteger(id)) return c.json({ error: "Bad request" }, 400);
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.deviceId, deviceId)));
  return c.json({ ok: true });
});

// ---------- iPhone / iCloud calendars (read into the app) ----------

const publicFeed = ({ id, name, color, url, createdAt }: typeof calendarFeeds.$inferSelect) => ({
  id,
  name,
  color,
  host: new URL(url).hostname,
  createdAt,
});

app.get("/api/calendars", async (c) => {
  const deviceId = deviceIdOf(c);
  if (!deviceId) return c.json({ error: "Missing device id" }, 400);
  const rows = await db.select().from(calendarFeeds).where(eq(calendarFeeds.deviceId, deviceId)).orderBy(asc(calendarFeeds.id));
  return c.json(rows.map(publicFeed));
});

app.post("/api/calendars", async (c) => {
  const deviceId = deviceIdOf(c);
  if (!deviceId) return c.json({ error: "Missing device id" }, 400);
  const body = (await c.req.json().catch(() => ({}))) as { url?: string; name?: string; color?: string };
  const url = normalizeFeedUrl(String(body.url ?? ""));
  if (!url) return c.json({ error: "Вставьте ссылку на календарь (начинается с webcal:// или https://)" }, 400);

  const [{ n }] = await db.select({ n: count() }).from(calendarFeeds).where(eq(calendarFeeds.deviceId, deviceId));
  if (n >= 10) return c.json({ error: "Можно подключить не больше 10 календарей" }, 400);

  let text: string;
  try {
    text = await fetchFeed(url, { fresh: true });
    expandEvents(text, 0, Date.now(), Date.now() + 1); // make sure it parses
  } catch (e) {
    return c.json({ error: (e as Error).message || "Не удалось прочитать календарь" }, 400);
  }
  const name = String(body.name ?? "").trim().slice(0, 80) || calendarName(text) || "Календарь iPhone";
  const color = COLOR_RE.test(String(body.color)) ? String(body.color) : "#ff3b30";
  const [row] = await db.insert(calendarFeeds).values({ deviceId, url, name, color }).returning();
  return c.json(publicFeed(row), 201);
});

app.delete("/api/calendars/:id", async (c) => {
  const deviceId = deviceIdOf(c);
  const id = Number(c.req.param("id"));
  if (!deviceId || !Number.isInteger(id)) return c.json({ error: "Bad request" }, 400);
  await db.delete(calendarFeeds).where(and(eq(calendarFeeds.id, id), eq(calendarFeeds.deviceId, deviceId)));
  return c.json({ ok: true });
});

const DAY = 86_400_000;

app.get("/api/calendar-events", async (c) => {
  const deviceId = deviceIdOf(c);
  if (!deviceId) return c.json({ error: "Missing device id" }, 400);
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return c.json({ error: "Неверный диапазон" }, 400);
  // Pad by a day on both sides so every timezone sees its full local days.
  const fromMs = Date.parse(from + "T00:00:00Z") - DAY;
  const toMs = Date.parse(to + "T00:00:00Z") + 2 * DAY;
  if (!(toMs > fromMs) || toMs - fromMs > 800 * DAY) return c.json({ error: "Слишком большой диапазон" }, 400);

  const feeds = await db.select().from(calendarFeeds).where(eq(calendarFeeds.deviceId, deviceId));
  const fresh = c.req.query("fresh") === "1";
  const events: ExternalEvent[] = [];
  const errors: { feedId: number; error: string }[] = [];
  await Promise.all(
    feeds.map(async (f) => {
      try {
        events.push(...expandEvents(await fetchFeed(f.url, { fresh }), f.id, fromMs, toMs));
      } catch (e) {
        errors.push({ feedId: f.id, error: (e as Error).message || "Ошибка загрузки" });
      }
    }),
  );
  return c.json({ events, errors });
});

// ---------- subscription feed of tasks (iPhone: Settings → Calendar → Add Subscribed Calendar) ----------

app.get("/api/feed/:file", async (c) => {
  const deviceId = c.req.param("file").replace(/\.ics$/i, "");
  if (!DEVICE_RE.test(deviceId)) return c.text("Not found", 404);
  const since = new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.deviceId, deviceId), gte(tasks.date, since)))
    .orderBy(asc(tasks.date), asc(tasks.time));
  return c.body(buildTaskFeed(rows), 200, {
    "content-type": "text/calendar; charset=utf-8",
    "content-disposition": 'inline; filename="ogonek.ics"',
    "cache-control": "no-store",
  });
});

export const config = {
  path: "/api/*",
};

export default app;
