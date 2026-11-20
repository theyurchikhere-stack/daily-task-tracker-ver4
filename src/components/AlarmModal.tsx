import type { Task } from "../types";
import { CATEGORIES } from "../types";

export default function AlarmModal({ task, onAction }: { task: Task; onAction: (a: "done" | "snooze" | "close") => void }) {
  return (
    <div className="overlay alarm-overlay">
      <div className="modal alarm" role="alertdialog" aria-label="Будильник">
        <div className="alarm-clock">⏰</div>
        <div className="alarm-time">{task.time}</div>
        <h2>{task.title}</h2>
        <p className="muted">
          {CATEGORIES[task.category].emoji} {CATEGORIES[task.category].label}
          {task.notes ? ` · ${task.notes}` : ""}
        </p>
        <div className="alarm-actions">
          <button className="btn primary lg" onClick={() => onAction("done")}>
            ✓ Готово
          </button>
          <button className="btn ghost lg" onClick={() => onAction("snooze")}>
            Отложить 5 мин
          </button>
        </div>
        <button className="link" onClick={() => onAction("close")}>
          Выключить
        </button>
      </div>
    </div>
  );
}
