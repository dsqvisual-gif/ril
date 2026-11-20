"use client";

import Image from "next/image";
import styles from "./TaskRow.module.css";
import type { TaskDTO } from "@/lib/actions/tasks";

type Props = {
  task: TaskDTO;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  busy?: boolean;
};

export function TaskRow({ task, onToggle, onDelete, busy }: Props) {
  const withWhom = task.partners.map((person) => person.name).join(", ");

  const tone = [
    styles.row,
    task.done ? styles.done : "",
    task.urgent ? styles.urgent : task.important ? styles.important : "",
  ]
    .filter(Boolean)
    .join(" ");

  // A mascot peeks out from behind every important open task.
  const peek = task.important && !task.done;

  return (
    <div className={peek ? `${styles.wrap} ${styles.wrapPeek}` : styles.wrap}>
      {peek ? (
        <Image
          src="/mascot-peek.webp"
          alt=""
          aria-hidden
          width={200}
          height={156}
          className={styles.peek}
        />
      ) : null}
      <div className={tone}>
        <button
          type="button"
          className={styles.check}
          aria-label={task.done ? "Снять отметку" : "Выполнить"}
          disabled={busy}
          onClick={() => onToggle(task.id)}
        >
          <span className={styles.dot}>{task.done ? "✓" : ""}</span>
        </button>
        <div className={styles.body}>
          <p className={styles.title}>{task.title}</p>
          {task.important ||
          task.urgent ||
          task.time ||
          task.shared ||
          (!task.done && task.originDate < task.date) ? (
            <div className={styles.meta}>
              {task.urgent ? (
                <span className={styles.urgentFlag}>Срочно</span>
              ) : null}
              {task.important ? (
                <span className={styles.importantFlag}>Важно</span>
              ) : null}
              {task.time ? (
                <span className={styles.time}>{task.time}</span>
              ) : null}
              {!task.done && task.originDate < task.date ? (
                <span className={styles.carried}>перенесено</span>
              ) : null}
              {task.shared && !task.viewerIsOwner && task.ownerName ? (
                <span className={styles.shared}>от {task.ownerName}</span>
              ) : null}
              {withWhom ? (
                <span className={styles.shared}>с {withWhom}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {task.viewerIsOwner ? (
          <button
            type="button"
            className={styles.delete}
            aria-label="Удалить"
            disabled={busy}
            onClick={() => onDelete(task.id)}
          >
            ×
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
