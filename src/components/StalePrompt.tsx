"use client";

import type { TaskDTO } from "@/lib/actions/tasks";
import { LINGER_DAYS } from "@/lib/dates";
import styles from "./StalePrompt.module.css";

type Props = {
  tasks: TaskDTO[];
  busyId?: string | null;
  onKeep: (id: string) => void;
  onDelete: (id: string) => void;
};

export function StalePrompt({ tasks, busyId, onKeep, onDelete }: Props) {
  if (tasks.length === 0) return null;

  return (
    <section className={styles.list} aria-label="Давние дела">
      {tasks.map((task) => {
        const busy = busyId === task.id;
        return (
          <article key={task.id} className={styles.card}>
            <p className={styles.kicker}>Это дело висит уже {LINGER_DAYS} дня. Оставить или удалить?</p>
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
