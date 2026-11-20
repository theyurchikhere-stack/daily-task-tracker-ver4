import type { tasks } from "../../db/schema.js";

type Task = typeof tasks.$inferSelect;

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");

/** Fold lines longer than 75 octets as required by RFC 5545. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    if (curLen + l > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += l;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return n.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Subscription feed with the device's tasks. Timed tasks use floating local time so the phone
 * shows them at the same wall-clock time; tasks with a reminder get a VALARM at the start time.
 */
export function buildTaskFeed(list: Task[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ogonek//Daily Tracker//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Огонёк — задачи",
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];
  for (const t of list) {
    const day = t.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:ogonek-task-${t.id}@daily-task-tracker`, `DTSTAMP:${stamp}`);
    if (t.time) {
      lines.push(`DTSTART:${day}T${t.time.replace(":", "")}00`, "DURATION:PT30M");
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(t.date)}`, "TRANSP:TRANSPARENT");
    }
    lines.push(`SUMMARY:${esc((t.completed ? "✓ " : "") + t.title)}`);
    if (t.notes) lines.push(`DESCRIPTION:${esc(t.notes)}`);
    lines.push(`CATEGORIES:${esc(t.category)}`);
    if (t.reminder && t.time && !t.completed) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(t.title)}`, "TRIGGER:-PT0M", "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
