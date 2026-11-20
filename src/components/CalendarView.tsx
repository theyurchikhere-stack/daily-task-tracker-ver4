import { useMemo, useState } from "react";
import type { DayEvent, Task } from "../types";
import { CATEGORIES } from "../types";
import { MONTHS, WEEKDAYS_SHORT, humanDate, mondayIndex, toKey, todayKey } from "../date";
import TaskItem from "./TaskItem";
import EventItem from "./EventItem";
import { groupByDate } from "../external";
import { Icon } from "./Icons";

interface Props {
  tasks: Task[];
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onAdd: (date: string) => void;
  events: DayEvent[];
  hasFeeds: boolean;
  onConnect: () => void;
}

export default function CalendarView({ tasks, onToggle, onEdit, onDelete, onAdd, events, hasFeeds, onConnect }: Props) {
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayKey());

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) map.set(t.date, [...(map.get(t.date) || []), t]);
    return map;
  }, [tasks]);

  const eventsByDate = useMemo(() => groupByDate(events), [events]);

  const cells = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const start = new Date(first);
    start.setDate(1 - mondayIndex(first));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { key: toKey(d), day: d.getDate(), inMonth: d.getMonth() === month.m };
    });
  }, [month]);

  const shift = (n: number) => {
    const d = new Date(month.y, month.m + n, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  const today = todayKey();
  const dayEvents = eventsByDate.get(selected) || [];
  const dayTasks = (byDate.get(selected) || []).slice().sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

  return (
    <div className="view">
      <header className="view-head">
        <h1>Календарь</h1>
        <p className="muted">
          Всё, что запланировано — по дням{hasFeeds ? ", вместе с событиями из календаря iPhone" : ""}
        </p>
        {!hasFeeds && (
          <button className="link" onClick={onConnect}>
            Подключить календарь iPhone →
          </button>
        )}
      </header>
      <div className="cal-layout">
        <section className="card cal">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
              <Icon name="chevL" />
            </button>
            <h2>
              {MONTHS[month.m]} {month.y}
            </h2>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Следующий месяц">
              <Icon name="chevR" />
            </button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="cal-wd">
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const list = byDate.get(c.key) || [];
              const done = list.filter((t) => t.completed).length;
              const all = list.length > 0 && done === list.length;
              const evs = eventsByDate.get(c.key) || [];
              return (
                <button
                  key={c.key}
                  className={`cal-cell ${c.inMonth ? "" : "out"} ${c.key === today ? "today" : ""} ${c.key === selected ? "sel" : ""} ${all ? "all-done" : ""}`}
                  onClick={() => setSelected(c.key)}
                >
                  <span className="cal-day">{c.day}</span>
                  {list.length > 0 && (
                    <>
                      <span className="cal-dots">
                        {list.slice(0, 4).map((t) => (
                          <i key={t.id} style={{ background: t.completed ? "var(--muted-2)" : CATEGORIES[t.category].color }} />
                        ))}
                      </span>
                      <span className="cal-count">
                        {done}/{list.length}
                      </span>
                    </>
                  )}
                  {evs.length > 0 && (
                    <span className="cal-evs" title={`${evs.length} в календаре iPhone`}>
                      {evs.slice(0, 3).map((e) => (
                        <i key={e.key} style={{ borderColor: e.color }} />
                      ))}
                    </span>
                  )}
                  {done > 0 && <span className="cal-fire">🔥</span>}
                </button>
              );
            })}
          </div>
        </section>
        <section className="card day-panel">
          <div className="day-panel-head">
            <h3>{humanDate(selected)}</h3>
            <button className="btn primary sm" onClick={() => onAdd(selected)}>
              <Icon name="plus" size={16} /> Задача
            </button>
          </div>
          {dayEvents.length > 0 && (
            <ul className="task-list compact day-events">
              {dayEvents.map((e) => (
                <EventItem key={e.key} event={e} />
              ))}
            </ul>
          )}
          {dayTasks.length === 0 ? (
            <p className="muted">{dayEvents.length ? "Задач нет." : "Ничего не запланировано."}</p>
          ) : (
            <ul className="task-list compact">
              {dayTasks.map((t) => (
                <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
