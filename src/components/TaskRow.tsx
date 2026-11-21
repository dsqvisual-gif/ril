"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./TaskRow.module.css";
import { TaskEditor } from "./AddTaskForm";
import type { CreateTaskInput, TaskDTO } from "@/lib/actions/tasks";
import type { FriendOption } from "@/lib/actions/friends";

type Props = {
  task: TaskDTO;
  friends: FriendOption[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, input: CreateTaskInput) => Promise<void>;
  busy?: boolean;
};

export function TaskRow({
  task,
  friends,
  onToggle,
  onDelete,
  onUpdate,
  busy,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TaskEditor
        friends={friends}
        withDate
        initial={{
          title: task.title,
          date: task.date,
          time: task.time,
          important: task.important,
          urgent: task.urgent,
          friendIds: task.partners.map((person) => person.id),
        }}
        submitLabel="Сохранить"
        onSubmit={async (input) => {
          await onUpdate(task.id, input);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

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
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.edit}
              aria-label="Изменить"
              title="Изменить"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              ✎
            </button>
            <button
              type="button"
              className={styles.delete}
              aria-label="Удалить"
              disabled={busy}
              onClick={() => onDelete(task.id)}
            >
              ×
            </button>
          </div>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
