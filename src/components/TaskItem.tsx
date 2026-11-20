import type { Task } from "../types";
import { CATEGORIES } from "../types";
import { Icon } from "./Icons";

interface Props {
  task: Task;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  showDate?: boolean;
}

export default function TaskItem({ task, onToggle, onEdit, onDelete }: Props) {
  const cat = CATEGORIES[task.category];
  return (
    <li className={`task ${task.completed ? "done" : ""} prio-${task.priority}`} style={{ "--cat": cat.color } as React.CSSProperties}>
      <button
        className="check"
        aria-label={task.completed ? "Отметить как невыполненную" : "Отметить как выполненную"}
        onClick={() => onToggle(task)}
      >
        <Icon name="check" size={16} />
      </button>
      <div className="task-body" onClick={() => onEdit(task)}>
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          <span className="chip" style={{ color: cat.color }}>
            {cat.emoji} {cat.label}
          </span>
          {task.time && (
            <span className="meta-item">
              <Icon name="clock" size={13} /> {task.time}
            </span>
          )}
          {task.reminder && task.time && (
            <span className="meta-item bell" title="Будильник включён">
              <Icon name="bell" size={13} />
            </span>
          )}
          {task.priority === "high" && <span className="meta-item hot">важно</span>}
          {task.notes && <span className="meta-item notes">{task.notes}</span>}
        </div>
      </div>
      <div className="task-actions">
        <button className="icon-btn" aria-label="Изменить" onClick={() => onEdit(task)}>
          <Icon name="edit" size={16} />
        </button>
        <button className="icon-btn danger" aria-label="Удалить" onClick={() => onDelete(task)}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  );
}
