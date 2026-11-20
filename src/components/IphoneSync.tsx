import { useState } from "react";
import type { CalendarFeed } from "../types";
import { taskFeedUrl } from "../api";
import { Icon } from "./Icons";

const COLORS = ["#ff3b30", "#34c759", "#0a84ff", "#ff9f0a", "#bf5af2", "#64d2ff"];

interface Props {
  feeds: CalendarFeed[];
  feedErrors: Record<number, string>;
  syncing: boolean;
  onAdd: (url: string, name: string, color: string) => Promise<void>;
  onRemove: (feed: CalendarFeed) => Promise<void>;
  onRefresh: () => Promise<void>;
  showToast: (m: string) => void;
}

export default function IphoneSync({ feeds, feedErrors, syncing, onAdd, onRemove, onRefresh, showToast }: Props) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[feeds.length % COLORS.length]);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(feeds.length === 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(url.trim(), name.trim(), color);
      setUrl("");
      setName("");
      setColor(COLORS[(feeds.length + 1) % COLORS.length]);
      setHelp(false);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string, msg: string) => {
    void navigator.clipboard?.writeText(text);
    showToast(msg);
  };

  const feedUrl = taskFeedUrl("webcal");

  return (
    <>
      <section className="card iphone">
        <div className="card-head">
          <h3>
            <Icon name="phone" size={16} /> Календарь iPhone → в приложение
          </h3>
          {feeds.length > 0 && (
            <button className="btn ghost sm" onClick={() => void onRefresh()} disabled={syncing}>
              <Icon name="refresh" size={14} /> {syncing ? "Обновляем…" : "Обновить"}
            </button>
          )}
        </div>
        <p className="muted small">
          События из календаря iPhone появятся на экранах «Сегодня» и «Календарь» рядом с вашими задачами. Обновляются автоматически.
        </p>

        {feeds.length > 0 && (
          <ul className="feed-list">
            {feeds.map((f) => (
              <li key={f.id} className="feed">
                <i style={{ background: f.color }} />
                <div>
                  <strong>{f.name}</strong>
                  <span className={feedErrors[f.id] ? "feed-err" : "muted"}>{feedErrors[f.id] || f.host}</span>
                </div>
                <button
                  className="icon-btn danger"
                  aria-label="Отключить календарь"
                  onClick={() => {
                    if (confirm(`Отключить «${f.name}»? События перестанут отображаться.`)) void onRemove(f);
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="feed-form" onSubmit={submit}>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="webcal://p…-caldav.icloud.com/published/2/…"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <div className="feed-form-row">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название (необязательно)" maxLength={80} />
            <div className="swatches" role="radiogroup" aria-label="Цвет">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  role="radio"
                  aria-checked={c === color}
                  className={`swatch ${c === color ? "on" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <button className="btn primary sm" disabled={!url.trim() || busy}>
              <Icon name="link" size={14} /> {busy ? "Проверяем…" : "Подключить"}
            </button>
          </div>
        </form>

        <button className="link" onClick={() => setHelp(!help)}>
          {help ? "Скрыть инструкцию" : "Где взять ссылку?"}
        </button>
        {help && (
          <ol className="steps">
            <li>
              Откройте <b>Календарь</b> на iPhone и нажмите <b>«Календари»</b> внизу экрана.
            </li>
            <li>
              Нажмите <b>ⓘ</b> рядом с нужным календарём iCloud (например, «Дом» или «Работа»).
            </li>
            <li>
              Включите <b>«Общий календарь»</b> (Public Calendar) и нажмите <b>«Поделиться ссылкой…» → «Скопировать»</b>.
            </li>
            <li>Вставьте ссылку в поле выше и нажмите «Подключить». Повторите для других календарей.</li>
            <li className="muted">
              Ссылка даёт доступ только на чтение. Календари Google тоже подходят: «Настройки → Секретный адрес в формате iCal».
            </li>
          </ol>
        )}
      </section>

      <section className="card iphone">
        <div className="card-head">
          <h3>
            <Icon name="bell" size={16} /> Задачи → в Календарь iPhone с будильником
          </h3>
        </div>
        <p className="muted small">
          Подпишитесь один раз — все задачи сами появятся в Календаре iPhone и будут обновляться. У задач с будильником iPhone покажет напоминание в
          назначенное время, даже когда приложение закрыто.
        </p>
        <div className="sync-row">
          <code className="code">{feedUrl}</code>
          <button className="btn ghost sm" onClick={() => copy(feedUrl, "Ссылка скопирована")}>
            Копировать
          </button>
        </div>
        <div className="sync-row">
          <a className="btn primary sm" href={feedUrl}>
            <Icon name="calendar" size={14} /> Подписаться на iPhone
          </a>
        </div>
        <ol className="steps">
          <li>
            Откройте эту страницу в Safari на iPhone и нажмите <b>«Подписаться на iPhone»</b>, затем «Подписаться».
          </li>
          <li>
            Или вручную: <b>Настройки → Приложения → Календарь → Учётные записи → Добавить учётную запись → Другое → Подписной календарь</b> и
            вставьте ссылку.
          </li>
          <li>
            Важно: в настройках подписки <b>выключите «Удалить предупреждения»</b>, иначе iPhone не будет звонить.
          </li>
          <li className="muted">Ссылка содержит ваш личный код — не публикуйте её.</li>
        </ol>
      </section>
    </>
  );
}
