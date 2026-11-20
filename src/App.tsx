import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import type { CalendarFeed, ExternalEventRaw, Task, TaskDraft } from "./types";
import { addDays, todayKey } from "./date";
import { toDayEvents } from "./external";
import { currentStreak } from "./stats";
import { dueReminders, markFired, notify, snooze, startAlarm, stopAlarm, unlockAudio } from "./alarm";
import TodayView from "./components/TodayView";
import CalendarView from "./components/CalendarView";
import StatsView from "./components/StatsView";
import RemindersView from "./components/RemindersView";
import TaskForm from "./components/TaskForm";
import AlarmModal from "./components/AlarmModal";
import { FlameIcon, NavIcon } from "./components/Icons";

type Tab = "today" | "calendar" | "stats" | "reminders";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "calendar", label: "Календарь" },
  { id: "stats", label: "Статистика" },
  { id: "reminders", label: "Напоминания" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ task?: Task; date: string } | null>(null);
  const [ringing, setRinging] = useState<Task | null>(null);
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [rawEvents, setRawEvents] = useState<ExternalEventRaw[]>([]);
  const [feedErrors, setFeedErrors] = useState<Record<number, string>>({});
  const [syncing, setSyncing] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      setTasks(await api.list());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- iPhone calendars (read-only events shown next to tasks) ----
  const loadEvents = useCallback(async (fresh = false) => {
    setSyncing(true);
    try {
      const list = await api.calendars();
      setFeeds(list);
      if (!list.length) {
        setRawEvents([]);
        setFeedErrors({});
        return;
      }
      const t = todayKey();
      const res = await api.calendarEvents(addDays(t, -120), addDays(t, 400), fresh);
      setRawEvents(res.events);
      setFeedErrors(Object.fromEntries(res.errors.map((e) => [e.feedId, e.error])));
    } catch {
      /* keep the last known events if the network hiccups */
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    const id = window.setInterval(() => void loadEvents(), 15 * 60_000);
    const onVisible = () => document.visibilityState === "visible" && void loadEvents();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadEvents]);

  const events = useMemo(() => toDayEvents(rawEvents, feeds), [rawEvents, feeds]);

  const addFeed = async (url: string, name: string, color: string) => {
    const feed = await api.addCalendar(url, name, color);
    setFeeds((f) => [...f, feed]);
    showToast(`Календарь «${feed.name}» подключён`);
    await loadEvents();
  };

  const removeFeed = async (feed: CalendarFeed) => {
    try {
      await api.removeCalendar(feed.id);
      setFeeds((f) => f.filter((x) => x.id !== feed.id));
      setRawEvents((ev) => ev.filter((e) => e.feedId !== feed.id));
      showToast("Календарь отключён");
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  const reloadAll = useCallback(async () => {
    await Promise.all([load(), loadEvents()]);
  }, [load, loadEvents]);

  useEffect(() => {
    void load();
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [load]);

  // Reminder / alarm loop: checks every 10 seconds while the app is open.
  useEffect(() => {
    const check = () => {
      if (ringing) return;
      const [due] = dueReminders(tasksRef.current);
      if (due) {
        markFired(due);
        setRinging(due);
        startAlarm();
        notify(due);
      }
    };
    check();
    const id = window.setInterval(check, 10_000);
    return () => window.clearInterval(id);
  }, [ringing, tasks]);

  const createTask = async (draft: TaskDraft) => {
    const created = await api.create(draft);
    setTasks((ts) => [...ts, created]);
    return created;
  };

  const updateTask = async (id: number, patch: Partial<Task>) => {
    const prev = tasksRef.current;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const updated = await api.update(id, patch);
      setTasks((ts) => ts.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setTasks(prev);
      showToast((e as Error).message);
    }
  };

  const toggleTask = async (task: Task) => {
    const wasLit = currentStreak(tasksRef.current).litToday;
    await updateTask(task.id, { completed: !task.completed });
    if (!task.completed && task.date === todayKey() && !wasLit) showToast("🔥 Огонёк зажжён! Серия продолжается");
  };

  const deleteTask = async (task: Task) => {
    const prev = tasksRef.current;
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    try {
      await api.remove(task.id);
      showToast("Задача удалена");
    } catch (e) {
      setTasks(prev);
      showToast((e as Error).message);
    }
  };

  const saveForm = async (draft: TaskDraft) => {
    if (editing?.task) {
      await updateTask(editing.task.id, draft);
      showToast("Изменения сохранены");
    } else {
      await createTask(draft);
      showToast(draft.reminder && draft.time ? `Задача добавлена, будильник на ${draft.time}` : "Задача добавлена");
    }
    setEditing(null);
  };

  const dismissAlarm = (action: "done" | "snooze" | "close") => {
    stopAlarm();
    if (!ringing) return;
    if (action === "done") void toggleTask(ringing);
    if (action === "snooze") {
      snooze(ringing, 5);
      showToast("Напомню через 5 минут");
    }
    setRinging(null);
  };

  const streak = useMemo(() => currentStreak(tasks), [tasks]);

  const common = {
    tasks,
    onToggle: toggleTask,
    onEdit: (task: Task) => setEditing({ task, date: task.date }),
    onDelete: deleteTask,
    onAdd: (date: string) => setEditing({ date }),
    events,
    hasFeeds: feeds.length > 0,
    onConnect: () => setTab("reminders"),
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className={`brand-flame ${streak.litToday ? "lit" : ""}`}>
            <FlameIcon />
          </span>
          <div>
            <div className="brand-name">Огонёк</div>
            <div className="brand-sub">трекер дня</div>
          </div>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <NavIcon name={t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className={`side-streak ${streak.litToday ? "lit" : ""}`}>
          <FlameIcon />
          <div>
            <strong>{streak.count}</strong>
            <span>{streak.litToday ? "дней подряд" : "выполните задачу, чтобы зажечь"}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        {error && (
          <div className="banner error">
            Не удалось загрузить задачи: {error}
            <button className="btn ghost sm" onClick={() => void load()}>
              Повторить
            </button>
          </div>
        )}
        {loading ? (
          <div className="loading">
            <span className="brand-flame lit pulse">
              <FlameIcon />
            </span>
            Разжигаем огонёк…
          </div>
        ) : (
          <>
            {tab === "today" && <TodayView {...common} streak={streak} onQuickAdd={createTask} />}
            {tab === "calendar" && <CalendarView {...common} />}
            {tab === "stats" && <StatsView tasks={tasks} />}
            {tab === "reminders" && <RemindersView
                {...common}
                onReload={reloadAll}
                showToast={showToast}
                sync={{ feeds, feedErrors, syncing, onAdd: addFeed, onRemove: removeFeed, onRefresh: () => loadEvents(true), showToast }}
              />}
          </>
        )}
      </main>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.id} className={`bnav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <NavIcon name={t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {editing && (
        <TaskForm initial={editing.task} date={editing.date} onCancel={() => setEditing(null)} onSave={saveForm} />
      )}
      {ringing && <AlarmModal task={ringing} onAction={dismissAlarm} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
