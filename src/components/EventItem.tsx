import type { DayEvent } from "../types";
import { Icon } from "./Icons";

function when(e: DayEvent) {
  if (e.time && e.endTime) return `${e.time}–${e.endTime}`;
  if (e.time) return e.time;
  if (e.endTime) return `до ${e.endTime}`;
  return "весь день";
}

/** Read-only row for an event that comes from the iPhone calendar. */
export default function EventItem({ event }: { event: DayEvent }) {
  return (
    <li className="event" style={{ "--cat": event.color } as React.CSSProperties}>
      <span className="event-time">{when(event)}</span>
      <div className="task-body">
        <div className="task-title">{event.title}</div>
        <div className="task-meta">
          <span className="chip" style={{ color: event.color }}>
            <Icon name="phone" size={12} /> {event.calendar}
          </span>
          {event.location && <span className="meta-item">📍 {event.location}</span>}
          {event.notes && <span className="meta-item notes">{event.notes}</span>}
        </div>
      </div>
    </li>
  );
}

export function EventList({ events, title = "Из календаря iPhone" }: { events: DayEvent[]; title?: string }) {
  if (!events.length) return null;
  return (
    <section className="events-block">
      <div className="events-head">
        <Icon name="calendar" size={14} /> {title}
        <span>{events.length}</span>
      </div>
      <ul className="task-list compact">
        {events.map((e) => (
          <EventItem key={e.key} event={e} />
        ))}
      </ul>
    </section>
  );
}
