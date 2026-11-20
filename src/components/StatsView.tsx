import { useMemo } from "react";
import type { Category, Task } from "../types";
import { CATEGORIES } from "../types";
import { WEEKDAYS_SHORT, addDays, fromKey, mondayIndex, plural, todayKey } from "../date";
import { bestStreak, currentStreak } from "../stats";

export default function StatsView({ tasks }: { tasks: Task[] }) {
  const today = todayKey();

  const s = useMemo(() => {
    const done = tasks.filter((t) => t.completed);
    const past = tasks.filter((t) => t.date <= today);
    const pastDone = past.filter((t) => t.completed).length;
    const week = Array.from({ length: 7 }, (_, i) => {
      const key = addDays(today, i - 6);
      const list = tasks.filter((t) => t.date === key);
      return { key, total: list.length, done: list.filter((t) => t.completed).length };
    });
    const weekDone = week.reduce((a, d) => a + d.done, 0);
    const byCat = (Object.keys(CATEGORIES) as Category[]).map((c) => {
      const list = tasks.filter((t) => t.category === c);
      return { c, total: list.length, done: list.filter((t) => t.completed).length };
    });
    // 15-week heatmap ending this week
    const start = addDays(today, -(mondayIndex(fromKey(today)) + 7 * 14));
    const counts = new Map<string, number>();
    for (const t of done) counts.set(t.date, (counts.get(t.date) || 0) + 1);
    const heat = Array.from({ length: 15 * 7 }, (_, i) => {
      const key = addDays(start, i);
      return { key, n: counts.get(key) || 0, future: key > today };
    });
    return {
      total: tasks.length,
      done: done.length,
      rate: past.length ? Math.round((pastDone / past.length) * 100) : 0,
      week,
      weekDone,
      byCat,
      heat,
      streak: currentStreak(tasks).count,
      best: bestStreak(tasks),
      upcoming: tasks.filter((t) => t.date > today && !t.completed).length,
    };
  }, [tasks, today]);

  const maxWeek = Math.max(1, ...s.week.map((d) => d.total));
  const level = (n: number) => (n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4);

  return (
    <div className="view">
      <header className="view-head">
        <h1>Статистика</h1>
        <p className="muted">Ваш прогресс и сила огонька</p>
      </header>

      <div className="tiles">
        <div className="card tile fire">
          <span className="tile-label">Текущая серия</span>
          <strong>🔥 {s.streak}</strong>
          <span className="muted small">{plural(s.streak, "день", "дня", "дней")}</span>
        </div>
        <div className="card tile">
          <span className="tile-label">Рекорд серии</span>
          <strong>{s.best}</strong>
          <span className="muted small">{plural(s.best, "день", "дня", "дней")}</span>
        </div>
        <div className="card tile">
          <span className="tile-label">Выполнено всего</span>
          <strong>{s.done}</strong>
          <span className="muted small">из {s.total} задач</span>
        </div>
        <div className="card tile">
          <span className="tile-label">Процент выполнения</span>
          <strong>{s.rate}%</strong>
          <span className="muted small">по прошедшим дням</span>
        </div>
      </div>

      <div className="stats-grid">
        <section className="card">
          <div className="card-head">
            <h3>Последние 7 дней</h3>
            <span className="muted small">{s.weekDone} выполнено</span>
          </div>
          <div className="bars">
            {s.week.map((d) => {
              const wd = WEEKDAYS_SHORT[mondayIndex(fromKey(d.key))];
              return (
                <div key={d.key} className={`bar-col ${d.key === today ? "today" : ""}`} title={`${d.done} из ${d.total}`}>
                  <span className="bar-val">{d.total ? `${d.done}/${d.total}` : ""}</span>
                  <div className="bar-track">
                    <div className="bar planned" style={{ height: `${(d.total / maxWeek) * 100}%` }} />
                    <div className="bar done" style={{ height: `${(d.done / maxWeek) * 100}%` }} />
                  </div>
                  <span className="bar-label">{wd}</span>
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><i className="lg done" /> выполнено</span>
            <span><i className="lg planned" /> запланировано</span>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>По категориям</h3>
          </div>
          <ul className="cat-list">
            {s.byCat.map(({ c, total, done }) => (
              <li key={c}>
                <div className="cat-row">
                  <span>
                    {CATEGORIES[c].emoji} {CATEGORIES[c].label}
                  </span>
                  <span className="muted small">
                    {done}/{total}
                  </span>
                </div>
                <div className="cat-track">
                  <div style={{ width: `${total ? (done / total) * 100 : 0}%`, background: CATEGORIES[c].color }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card wide">
          <div className="card-head">
            <h3>Активность за 15 недель</h3>
            <span className="muted small">{s.upcoming} задач впереди</span>
          </div>
          <div className="heat-wrap">
            <div className="heat-wd">
              {WEEKDAYS_SHORT.map((w, i) => (
                <span key={w}>{i % 2 === 0 ? w : ""}</span>
              ))}
            </div>
            <div className="heat">
              {s.heat.map((h) => (
                <span
                  key={h.key}
                  className={`hc l${level(h.n)} ${h.future ? "future" : ""} ${h.key === today ? "today" : ""}`}
                  title={`${h.key}: выполнено ${h.n}`}
                />
              ))}
            </div>
          </div>
          <div className="legend">
            <span className="muted small">меньше</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <i key={l} className={`hc l${l}`} />
            ))}
            <span className="muted small">больше</span>
          </div>
        </section>
      </div>
    </div>
  );
}
