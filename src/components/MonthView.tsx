"use client";

import {
  getMonthGrid,
  fromDateKey,
  isSameMonth,
  todayKey,
} from "@/lib/dates";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { TaskDTO } from "@/lib/actions/tasks";
import styles from "./MonthView.module.css";

type Props = {
  date: string;
  tasks: TaskDTO[];
  onSelectDay: (date: string) => void;
};

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function MonthView({ date, tasks, onSelectDay }: Props) {
  const days = getMonthGrid(date);
  const today = todayKey();
  const counts = new Map<string, { total: number; done: number }>();

  for (const task of tasks) {
    const cur = counts.get(task.date) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (task.done) cur.done += 1;
    counts.set(task.date, cur);
  }

  return (
    <section className={styles.root}>
      <div className={styles.weekdays}>
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className={styles.grid}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, date);
          const c = counts.get(day);
          const dayNum = format(fromDateKey(day), "d", { locale: ru });
          return (
            <button
              key={day}
              type="button"
              className={[
                styles.cell,
                !inMonth ? styles.muted : "",
                day === today ? styles.today : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDay(day)}
            >
              <span className={styles.num}>{dayNum}</span>
              {c ? (
                <span className={styles.dots} aria-label={`${c.total} задач`}>
                  {Array.from({ length: Math.min(c.total, 4) }).map((_, i) => (
                    <i
                      key={i}
                      className={i < c.done ? styles.dotDone : styles.dotOpen}
                    />
                  ))}
                </span>
              ) : (
                <span className={styles.dots} />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
