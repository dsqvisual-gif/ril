"use client";

import { getWeekDays, formatShortDay, todayKey } from "@/lib/dates";
import type { TaskDTO } from "@/lib/actions/tasks";
import styles from "./WeekView.module.css";

type Props = {
  date: string;
  tasks: TaskDTO[];
  onSelectDay: (date: string) => void;
};

export function WeekView({ date, tasks, onSelectDay }: Props) {
  const days = getWeekDays(date);
  const today = todayKey();
  const byDate = groupByDate(tasks);

  return (
    <section className={styles.root}>
      <div className={styles.grid}>
        {days.map((day) => {
          const dayTasks = byDate.get(day) ?? [];
          const open = dayTasks.filter((t) => !t.done).length;
          const done = dayTasks.filter((t) => t.done).length;
          return (
            <button
              key={day}
              type="button"
              className={`${styles.col} ${day === today ? styles.today : ""}`}
              onClick={() => onSelectDay(day)}
            >
              <span className={styles.dayLabel}>{formatShortDay(day)}</span>
              <span className={styles.count}>
                {dayTasks.length === 0
                  ? "пусто"
                  : `${open} · ${done} ✓`}
              </span>
              <ul className={styles.preview}>
                {dayTasks.slice(0, 3).map((t) => (
                  <li
                    key={t.id}
                    className={[
                      t.done ? styles.doneItem : "",
                      t.urgent ? styles.urgentItem : t.important ? styles.importantItem : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
                  >
                    {t.time ? <em>{t.time}</em> : null}
                    {t.title}
                  </li>
                ))}
                {dayTasks.length > 3 ? (
                  <li className={styles.more}>+{dayTasks.length - 3}</li>
                ) : null}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function groupByDate(tasks: TaskDTO[]) {
  const map = new Map<string, TaskDTO[]>();
  for (const task of tasks) {
    const list = map.get(task.date) ?? [];
    list.push(task);
    map.set(task.date, list);
  }
  return map;
}
