import type { Task } from "./types";

let ctx: AudioContext | null = null;
let timer: number | null = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === "suspended") void ctx.resume();
}

function beep(at: number, freq: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.25);
}

function ring() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [0, 0.28, 0.56].forEach((o, i) => beep(t + o, i === 2 ? 1175 : 880));
  if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 300]);
}

/** Start a looping alarm sound until stopAlarm() is called. */
export function startAlarm() {
  unlockAudio();
  stopAlarm();
  ring();
  timer = window.setInterval(ring, 1400);
}

export function stopAlarm() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}

export function testAlarm() {
  unlockAudio();
  ring();
}

// ---- reminder bookkeeping (per device) ----
const FIRED = "ogonek-fired";
const SNOOZE = "ogonek-snooze";

function readMap(k: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(k) || "{}");
  } catch {
    return {};
  }
}

export const reminderKey = (t: Task) => `${t.id}|${t.date}|${t.time}`;

export function markFired(t: Task) {
  const m = readMap(FIRED);
  m[reminderKey(t)] = Date.now();
  localStorage.setItem(FIRED, JSON.stringify(m));
  const s = readMap(SNOOZE);
  delete s[reminderKey(t)];
  localStorage.setItem(SNOOZE, JSON.stringify(s));
}

export function snooze(t: Task, minutes: number) {
  const s = readMap(SNOOZE);
  s[reminderKey(t)] = Date.now() + minutes * 60_000;
  localStorage.setItem(SNOOZE, JSON.stringify(s));
}

export function reminderTime(t: Task): number | null {
  if (!t.time) return null;
  const [y, m, d] = t.date.split("-").map(Number);
  const [hh, mm] = t.time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

/** Tasks whose alarm should ring right now. Only rings for alarms due within the last 2 hours. */
export function dueReminders(tasks: Task[], now = Date.now()): Task[] {
  const fired = readMap(FIRED);
  const snoozed = readMap(SNOOZE);
  return tasks.filter((t) => {
    if (!t.reminder || t.completed) return false;
    const at = reminderTime(t);
    if (at === null) return false;
    const key = reminderKey(t);
    if (snoozed[key]) return snoozed[key] <= now;
    if (fired[key]) return false;
    const created = new Date(t.createdAt).getTime();
    if (at < created - 60_000) return false; // planned in the past, nothing to ring
    return at <= now && now - at < 2 * 60 * 60_000;
  });
}

export function notify(t: Task) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("⏰ Огонёк: пора!", { body: `${t.time} — ${t.title}`, tag: reminderKey(t), requireInteraction: true });
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}

// ---- export to the phone's calendar / alarm (.ics with VALARM) ----
const icsDate = (t: Task) => `${t.date.replace(/-/g, "")}T${(t.time || "09:00").replace(":", "")}00`;
const esc = (s: string) => s.replace(/[\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

export function buildIcs(list: Task[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = list.map((t) =>
    [
      "BEGIN:VEVENT",
      `UID:ogonek-${t.id}@daily-task-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(t)}`,
      "DURATION:PT30M",
      `SUMMARY:${esc(t.title)}`,
      t.notes ? `DESCRIPTION:${esc(t.notes)}` : "",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(t.title)}`,
      "TRIGGER:-PT0M",
      "END:VALARM",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n"),
  );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ogonek//Daily Tracker//RU", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}

export function downloadIcs(list: Task[], filename = "ogonek-reminders.ics") {
  const blob = new Blob([buildIcs(list)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
