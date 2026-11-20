import ICAL from "ical.js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** One occurrence of an event from an external (iPhone / iCloud) calendar. */
export interface ExternalEvent {
  uid: string;
  feedId: number;
  title: string;
  location: string;
  notes: string;
  allDay: boolean;
  /**
   * All-day: start date "YYYY-MM-DD" (end is exclusive).
   * Timed: ISO instant, or "YYYY-MM-DDTHH:MM:SS" wall time when `floating` (no timezone in the feed).
   */
  start: string;
  end: string;
  floating: boolean;
}

// ---------- URL validation (no requests to private networks) ----------

export function normalizeFeedUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^webcals?:\/\//i, "https://");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (s.length > 2000) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Недопустимый адрес календаря");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("Недопустимый адрес календаря");
}

const MAX_BYTES = 8 * 1024 * 1024;
const cache = new Map<string, { at: number; text: string }>();
const CACHE_MS = 5 * 60_000;

/** Download an .ics feed (follows up to 4 redirects, each one re-validated). */
export async function fetchFeed(url: string, { fresh = false } = {}): Promise<string> {
  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.text;

  let current = new URL(url);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current, {
      redirect: "manual",
      headers: { accept: "text/calendar, */*", "user-agent": "Ogonek-Daily-Tracker/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      if (current.protocol === "webcal:") current = new URL(current.toString().replace(/^webcal:/, "https:"));
      if (current.protocol !== "https:") throw new Error("Недопустимый адрес календаря");
      continue;
    }
    if (res.status === 404 || res.status === 403) {
      throw new Error("Календарь не найден. Проверьте, что в iPhone включён «Общий календарь» и ссылка скопирована целиком");
    }
    if (!res.ok) throw new Error(`Сервер календаря ответил ошибкой ${res.status}`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) throw new Error("Календарь слишком большой");
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("Календарь слишком большой");
    const text = new TextDecoder().decode(buf);
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("По ссылке нет календаря в формате iCalendar");
    cache.set(url, { at: Date.now(), text });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return text;
  }
  throw new Error("Слишком много перенаправлений");
}

// ---------- parsing & recurrence expansion ----------

function parseCalendar(text: string) {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      /* ignore broken timezone definitions */
    }
  }
  return root;
}

/** Calendar display name from the feed (X-WR-CALNAME), if any. */
export function calendarName(text: string): string | null {
  try {
    const name = parseCalendar(text).getFirstPropertyValue("x-wr-calname");
    return typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : null;
  } catch {
    return null;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

function isFloating(t: ICAL.Time) {
  return !t.isDate && t.zone === ICAL.Timezone.localTimezone;
}

function serialize(t: ICAL.Time): string {
  if (t.isDate) return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
  if (isFloating(t)) return `${t.year}-${pad(t.month)}-${pad(t.day)}T${pad(t.hour)}:${pad(t.minute)}:00`;
  return t.toJSDate().toISOString();
}

/** Comparable epoch ms (floating/all-day treated as UTC; callers pad the range by a day). */
function epoch(t: ICAL.Time): number {
  if (t.isDate || isFloating(t)) return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  return t.toJSDate().getTime();
}

const MAX_EVENTS = 4000;
const MAX_ITER = 20_000;

/** Expand all events of a feed that overlap [fromMs, toMs). */
export function expandEvents(text: string, feedId: number, fromMs: number, toMs: number): ExternalEvent[] {
  const root = parseCalendar(text);
  const vevents = root.getAllSubcomponents("vevent");
  const masters = new Map<string, ICAL.Event>();
  const orphans: ICAL.Event[] = [];
  const exceptions: ICAL.Component[] = [];

  for (const v of vevents) {
    if (v.hasProperty("recurrence-id")) exceptions.push(v);
    else {
      const ev = new ICAL.Event(v);
      masters.set(ev.uid || `noid-${masters.size}`, ev);
    }
  }
  for (const ex of exceptions) {
    const uid = String(ex.getFirstPropertyValue("uid") ?? "");
    const master = masters.get(uid);
    if (master) {
      try {
        master.relateException(ex);
      } catch {
        orphans.push(new ICAL.Event(ex));
      }
    } else orphans.push(new ICAL.Event(ex));
  }

  const out: ExternalEvent[] = [];
  const push = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null) => {
    if (out.length >= MAX_EVENTS) return;
    if (String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") return;
    let stop = end;
    if (!stop || epoch(stop) < epoch(start)) {
      stop = start.clone();
      if (start.isDate) stop.day += 1;
    }
    if (epoch(stop) < fromMs || epoch(start) >= toMs) return;
    out.push({
      uid: `${feedId}:${item.uid || "x"}:${serialize(start)}`,
      feedId,
      title: (item.summary || "Без названия").slice(0, 300),
      location: (item.location || "").slice(0, 300),
      notes: (item.description || "").slice(0, 1000),
      allDay: start.isDate,
      start: serialize(start),
      end: serialize(stop),
      floating: isFloating(start),
    });
  };

  const all = [...masters.values(), ...orphans];
  for (const ev of all) {
    if (!ev.startDate) continue;
    try {
      if (!ev.isRecurring()) {
        push(ev, ev.startDate, ev.endDate);
        continue;
      }
      const it = ev.iterator();
      for (let i = 0, next = it.next(); next && i < MAX_ITER; i++, next = it.next()) {
        if (epoch(next) >= toMs) break;
        const d = ev.getOccurrenceDetails(next);
        push(d.item, d.startDate, d.endDate);
        if (out.length >= MAX_EVENTS) break;
      }
    } catch {
      /* skip malformed event */
    }
  }
  return out;
}
