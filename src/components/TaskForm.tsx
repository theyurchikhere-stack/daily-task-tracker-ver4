import { useEffect, useState } from "react";
import type { Category, Priority, Task, TaskDraft } from "../types";
import { CATEGORIES, PRIORITIES } from "../types";

interface Props {
  initial?: Task;
  date: string;
  onCancel: () => void;
  onSave: (d: TaskDraft) => Promise<void>;
}

export default function TaskForm({ initial, date, onCancel, onSave }: Props) {
  const [d, setD] = useState<TaskDraft>({
    title: initial?.title ?? "",
    notes: initial?.notes ?? "",
    date: initial?.date ?? date,
    time: initial?.time ?? "",
    category: initial?.category ?? "personal",
    priority: initial?.priority ?? "medium",
    reminder: initial?.reminder ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) return setError("Введите название");
    setBusy(true);
    try {
      await onSave({ ...d, time: d.time || null, reminder: Boolean(d.time) && d.reminder });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="modal" onSubmit={submit}>
        <h2>{initial ? "Изменить задачу" : "Новая задача"}</h2>
        <label className="field">
          <span>Название</span>
          <input className="input" autoFocus value={d.title} maxLength={200} onChange={(e) => set("title", e.target.value)} placeholder="Например, утренняя пробежка" />
        </label>
        <label className="field">
          <span>Заметка</span>
          <textarea className="input" rows={2} value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Необязательно" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Дата</span>
            <input className="input" type="date" required value={d.date} onChange={(e) => set("date", e.target.value)} />
          </label>
          <label className="field">
            <span>Время</span>
            <input
              className="input"
              type="time"
              value={d.time ?? ""}
              onChange={(e) => setD((p) => ({ ...p, time: e.target.value, reminder: e.target.value ? (p.time ? p.reminder : true) : false }))}
            />
          </label>
        </div>
        <div className="field">
          <span>Категория</span>
          <div className="pills">
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <button type="button" key={c} className={`pill ${d.category === c ? "on" : ""}`} style={{ "--cat": CATEGORIES[c].color } as React.CSSProperties} onClick={() => set("category", c)}>
                {CATEGORIES[c].emoji} {CATEGORIES[c].label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Приоритет</span>
          <div className="seg">
            {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
              <button type="button" key={p} className={`seg-btn ${d.priority === p ? "on" : ""} p-${p}`} onClick={() => set("priority", p)}>
                {PRIORITIES[p].label}
              </button>
            ))}
          </div>
        </div>
        <label className={`toggle ${!d.time ? "disabled" : ""}`}>
          <input type="checkbox" checked={d.reminder && Boolean(d.time)} disabled={!d.time} onChange={(e) => set("reminder", e.target.checked)} />
          <span className="switch" />
          <span>
            ⏰ Будильник {d.time ? `в ${d.time}` : "— сначала укажите время"}
          </span>
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Отмена
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Сохраняем…" : initial ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </form>
    </div>
  );
}
