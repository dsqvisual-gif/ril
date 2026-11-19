"use client";

import type { TaskDTO } from "@/lib/actions/tasks";
import styles from "./StalePrompt.module.css";

type Props = {
  tasks: TaskDTO[];
  busyId?: string | null;
  onKeep: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
};

export function StalePrompt({ tasks, busyId, onKeep, onArchive, onDelete }: Props) {
  if (tasks.length === 0) return null;

  return (
    <section className={styles.list} aria-label="Задачи без приоритета">
      {tasks.map((task) => {
        const busy = busyId === task.id;
        return (
          <article key={task.id} className={styles.card}>
            <p className={styles.kicker}>Кажется, эта задача не в приоритете</p>
            <p className={styles.title}>{task.title}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => onKeep(task.id)}
              >
                Оставить
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => onArchive(task.id)}
              >
                В архив
              </button>
              <button
                type="button"
                className={`${styles.remove} btn`}
                disabled={busy}
                onClick={() => onDelete(task.id)}
              >
                Удалить
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
