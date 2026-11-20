import type { CalendarFeed, DayEvent, ExternalEventRaw } from "./types";
import { addDays, pad, toKey } from "./date";

const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Floating times ("YYYY-MM-DDTHH:MM:SS", no zone) are parsed as local time by the JS Date parser. */
const parse = (s: string) => new Date(s);

/** Place each occurrence on the user's local day(s). Multi-day events appear on every day they cover. */
export function toDayEvents(raw: ExternalEventRaw[], feeds: CalendarFeed[]): DayEvent[] {
  const byId = new Map(feeds.map((f) => [f.id, f]));
  const out: DayEvent[] = [];
  for (const e of raw) {
    const feed = byId.get(e.feedId);
    if (!feed) continue;
    const base = { feedId: e.feedId, title: e.title, location: e.location, notes: e.notes, color: feed.color, calendar: feed.name };
    if (e.allDay) {
      let day = e.start;
      for (let i = 0; i < 60 && day < e.end; i++, day = addDays(day, 1)) {
        out.push({ ...base, key: `${e.uid}|${day}`, date: day, time: null, endTime: null });
      }
      continue;
    }
    const start = parse(e.start);
    const end = parse(e.end);
    if (Number.isNaN(start.getTime())) continue;
    const first = toKey(start);
    const last = Number.isNaN(end.getTime()) || end <= start ? first : toKey(new Date(end.getTime() - 1));
    const sameDay = first === last;
    out.push({ ...base, key: `${e.uid}|${first}`, date: first, time: hhmm(start), endTime: sameDay && end > start ? hhmm(end) : null });
    let day = addDays(first, 1);
    for (let i = 0; i < 60 && day <= last; i++, day = addDays(day, 1)) {
      out.push({ ...base, key: `${e.uid}|${day}`, date: day, time: null, endTime: day === last ? hhmm(end) : null });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

export function groupByDate(events: DayEvent[]) {
  const map = new Map<string, DayEvent[]>();
  for (const e of events) map.set(e.date, [...(map.get(e.date) || []), e]);
  return map;
}
