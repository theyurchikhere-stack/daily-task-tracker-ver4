import { useMemo, useState } from "react";
import type { DayEvent, Task, TaskDraft } from "../types";
import { addDays, humanDate, plural, todayKey } from "../date";
import { bestStreak } from "../stats";
import TaskItem from "./TaskItem";
import { EventList } from "./EventItem";
import { FlameIcon, Icon } from "./Icons";

interface Props {
  tasks: Task[];
  streak: { count: number; litToday: boolean };
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onAdd: (date: string) => void;
  onQuickAdd: (d: TaskDraft) => Promise<Task>;
  events: DayEvent[];
  hasFeeds: boolean;
  onConnect: () => void;
}

const DAILY_GOAL = 10;

export default function TodayView({ tasks, streak, onToggle, onEdit, onDelete, onAdd, onQuickAdd, events, hasFeeds, onConnect }: Props) {
  const [date, setDate] = useState(todayKey());
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.date === date)
        .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.time || "99").localeCompare(b.time || "99") || a.id - b.id),
    [tasks, date],
  );
  const dayEvents = useMemo(() => events.filter((e) => e.date === date), [events, date]);
  const done = dayTasks.filter((t) => t.completed).length;
  const total = dayTasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const best = useMemo(() => bestStreak(tasks), [tasks]);
  const isToday = date === todayKey();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await onQuickAdd({ title, notes: "", date, time: time || null, category: "personal", priority: "medium", reminder: Boolean(time) });
      setTitle("");
      setTime("");
    } finally {
      setBusy(false);
    }
  };

  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="view">
      <header className="view-head">
        <div className="day-switch">
          <button className="icon-btn" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
            <Icon name="chevL" />
          </button>
          <div>
            <h1>{humanDate(date)}</h1>
            {!isToday && (
              <button className="link" onClick={() => setDate(todayKey())}>
                Вернуться к сегодня
              </button>
            )}
          </div>
          <button className="icon-btn" aria-label="Следующий день" onClick={() => setDate(addDays(date, 1))}>
            <Icon name="chevR" />
          </button>
        </div>
      </header>

      <section className="hero-grid">
        <div className={`card streak-card ${streak.litToday ? "lit" : ""}`}>
          <div className="big-flame">
            <FlameIcon size={84} />
          </div>
          <div>
            <div className="streak-num">{streak.count}</div>
            <div className="streak-label">{plural(streak.count, "день", "дня", "дней")} подряд</div>
            <div className="muted small">
              {streak.litToday ? "Огонёк горит — так держать!" : streak.count ? "Выполните задачу сегодня, чтобы не потерять серию" : "Выполните первую задачу, чтобы зажечь огонёк"}
            </div>
            <div className="muted small">Рекорд: {best} {plural(best, "день", "дня", "дней")}</div>
          </div>
        </div>

        <div className="card progress-card">
          <svg viewBox="0 0 120 120" className="ring">
            <circle cx="60" cy="60" r={R} className="ring-bg" />
            <circle cx="60" cy="60" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} />
          </svg>
          <div className="ring-text">
            <strong>{pct}%</strong>
            <span>
              {done} из {total}
            </span>
          </div>
          <div className="goal">
            <div className="goal-label">Цель дня — {DAILY_GOAL} задач</div>
            <div className="goal-dots">
              {Array.from({ length: Math.max(DAILY_GOAL, total) }).map((_, i) => (
                <span key={i} className={`dot ${i < done ? "on" : i < total ? "planned" : ""}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <form className="quick-add card" onSubmit={submit}>
        <Icon name="plus" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Новая задача… (Enter — добавить)" maxLength={200} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="time-input" title="Время и будильник" />
        <button className="btn primary" disabled={!title.trim() || busy}>
          Добавить
        </button>
        <button type="button" className="btn ghost" onClick={() => onAdd(date)} title="Подробная форма">
          Ещё…
        </button>
      </form>

      <EventList events={dayEvents} />
      {!hasFeeds && (
        <button className="connect-hint" onClick={onConnect}>
          <Icon name="phone" size={16} /> Подключите календарь iPhone, чтобы видеть здесь свои встречи и события
          <Icon name="chevR" size={16} />
        </button>
      )}

      {total === 0 ? (
        <div className="empty card">
          <div className="empty-emoji">📝</div>
          <h3>На этот день задач нет</h3>
          <p className="muted">Добавьте до {DAILY_GOAL} задач и больше — укажите время, чтобы прозвенел будильник.</p>
        </div>
      ) : (
        <ul className="task-list">
          {dayTasks.map((t) => (
            <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      )}
      {total > 0 && total < DAILY_GOAL && (
        <p className="muted small center">
          Ещё {DAILY_GOAL - total} {plural(DAILY_GOAL - total, "задача", "задачи", "задач")} до цели дня
        </p>
      )}
    </div>
  );
}
