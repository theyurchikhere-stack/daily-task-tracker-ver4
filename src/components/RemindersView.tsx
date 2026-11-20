import { useMemo, useState } from "react";
import type { Task } from "../types";
import { getDeviceId, setDeviceId } from "../api";
import { downloadIcs, reminderTime, testAlarm } from "../alarm";
import { humanDate } from "../date";
import TaskItem from "./TaskItem";
import { Icon } from "./Icons";
import IphoneSync from "./IphoneSync";

interface Props {
  tasks: Task[];
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onAdd: (date: string) => void;
  onReload: () => Promise<void>;
  showToast: (m: string) => void;
  sync: React.ComponentProps<typeof IphoneSync>;
}

export default function RemindersView({ tasks, onToggle, onEdit, onDelete, onReload, showToast, sync }: Props) {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : "denied");
  const [code, setCode] = useState("");

  const upcoming = useMemo(() => {
    const now = Date.now() - 60 * 60_000;
    return tasks
      .filter((t) => t.reminder && t.time && !t.completed && (reminderTime(t) ?? 0) >= now)
      .sort((a, b) => (reminderTime(a) ?? 0) - (reminderTime(b) ?? 0));
  }, [tasks]);

  const groups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of upcoming) m.set(t.date, [...(m.get(t.date) || []), t]);
    return [...m.entries()];
  }, [upcoming]);

  const ask = async () => {
    if (!supported) return;
    setPerm(await Notification.requestPermission());
  };

  const link = async () => {
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(code.trim())) return showToast("Неверный код синхронизации");
    setDeviceId(code.trim());
    setCode("");
    await onReload();
    showToast("Устройство подключено");
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>Напоминания</h1>
        <p className="muted">Будильник звонит в указанное время задачи. Здесь же — связь с Календарём iPhone.</p>
      </header>

      <IphoneSync {...sync} />

      <div className="rem-grid">
        <section className="card setting">
          <div className="setting-icon">⏰</div>
          <div className="setting-body">
            <h3>Будильник в приложении</h3>
            <p className="muted small">Пока вкладка открыта, в момент задачи прозвучит сигнал, появится окно с кнопками «Готово» и «Отложить на 5 мин».</p>
            <button className="btn ghost sm" onClick={() => testAlarm()}>
              Проверить звук
            </button>
          </div>
        </section>
        <section className="card setting">
          <div className="setting-icon">🔔</div>
          <div className="setting-body">
            <h3>Системные уведомления</h3>
            <p className="muted small">
              {perm === "granted"
                ? "Включены — напоминание появится даже в фоновой вкладке."
                : perm === "denied"
                  ? "Заблокированы в настройках браузера."
                  : "Разрешите уведомления, чтобы видеть напоминания поверх других окон."}
            </p>
            {perm === "default" && (
              <button className="btn primary sm" onClick={ask}>
                Разрешить
              </button>
            )}
          </div>
        </section>
        <section className="card setting">
          <div className="setting-icon">📱</div>
          <div className="setting-body">
            <h3>Разовый экспорт</h3>
            <p className="muted small">Скачайте .ics с ближайшими будильниками. Для постоянной связи используйте подписку выше.</p>
            <button className="btn ghost sm" disabled={!upcoming.length} onClick={() => downloadIcs(upcoming)}>
              <Icon name="download" size={16} /> Экспорт ({upcoming.length})
            </button>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Ближайшие будильники</h3>
          <span className="muted small">{upcoming.length}</span>
        </div>
        {groups.length === 0 ? (
          <p className="muted">Нет активных напоминаний. Укажите время у задачи и включите будильник.</p>
        ) : (
          groups.map(([date, list]) => (
            <div key={date} className="rem-group">
              <div className="rem-date">{humanDate(date)}</div>
              <ul className="task-list compact">
                {list.map((t) => (
                  <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="card sync">
        <div className="card-head">
          <h3>Синхронизация устройств</h3>
        </div>
        <p className="muted small">Ваш личный код. Введите его на другом устройстве, чтобы видеть те же задачи. Никому его не передавайте.</p>
        <div className="sync-row">
          <code className="code">{getDeviceId()}</code>
          <button
            className="btn ghost sm"
            onClick={() => {
              void navigator.clipboard?.writeText(getDeviceId());
              showToast("Код скопирован");
            }}
          >
            Копировать
          </button>
        </div>
        <div className="sync-row">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код с другого устройства" />
          <button className="btn primary sm" onClick={link} disabled={!code.trim()}>
            Подключить
          </button>
        </div>
      </section>
    </div>
  );
}
