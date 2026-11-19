"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { removeTask, restoreTask, type ArchivedTask } from "@/lib/actions/tasks";
import { fromDateKey, todayKey } from "@/lib/dates";
import { errorText, unwrap, type ActionResult } from "@/lib/action-result";
import styles from "./ArchiveList.module.css";

type Props = {
  tasks: ArchivedTask[];
};

export function ArchiveList({ tasks }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<ActionResult<void>>) {
    setBusyId(id);
    setError(null);
    try {
      unwrap(await action());
      router.refresh();
    } catch (err) {
      setError(errorText(err, "Не получилось"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.root}>
      <header>
        <h1 className={styles.title}>Архив</h1>
        <p className={styles.sub}>Дела, которые вы решили пока убрать из планера.</p>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      {tasks.length === 0 ? (
        <p className={styles.empty}>В архиве пока пусто.</p>
      ) : (
        <ul className={styles.list}>
          {tasks.map((task) => (
            <li key={task.id} className={styles.row}>
              <div>
                <p className={styles.name}>{task.title}</p>
                <p className={styles.meta}>
                  {format(fromDateKey(task.originDate), "d MMMM", { locale: ru })}
                  {task.urgent ? " · срочно" : task.important ? " · важно" : ""}
                </p>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === task.id}
                  onClick={() => run(task.id, () => restoreTask(task.id, todayKey()))}
                >
                  Вернуть
                </button>
                {task.viewerIsOwner ? (
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={busyId === task.id}
                    onClick={() => run(task.id, () => removeTask(task.id))}
                  >
                    Удалить
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
