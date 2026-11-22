"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { TaskRow, type TaskHandlers } from "./TaskRow";
import { markSwipeLearned, useSwipeHint } from "./planner/swipe-hint";
import { AddTaskForm } from "./AddTaskForm";
import {
  formatDayTitle,
  fromDateKey,
  plannerDayHeading,
  relativeDayName,
  todayKey,
} from "@/lib/dates";
import type { CreateTaskInput, TaskDTO } from "@/lib/actions/tasks";
import type { FriendOption } from "@/lib/actions/friends";
import styles from "./DayView.module.css";

type Props = {
  date: string;
  tasks: TaskDTO[];
  friends: FriendOption[];
  onCreate: (input: CreateTaskInput) => Promise<void>;
  handlers: TaskHandlers;
  busyId?: string | null;
};

export function DayView({
  date,
  tasks,
  friends,
  onCreate,
  handlers,
  busyId,
}: Props) {
  const swipeHint = useSwipeHint();
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const named = relativeDayName(date);

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <h2 className={styles.title}>{plannerDayHeading(date)}</h2>
        <p className={styles.dateLine}>
          {named
            ? formatDayTitle(date)
            : format(fromDateKey(date), "EEEE", { locale: ru })}
        </p>
        <p className={styles.meta}>{summary(date, open.length, done.length)}</p>
      </header>

      <div className={styles.list}>
        {open.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            friends={friends}
            {...handlers}
            busy={busyId === task.id}
          />
        ))}
        {done.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            friends={friends}
            {...handlers}
            busy={busyId === task.id}
          />
        ))}
      </div>

      {swipeHint && open.length > 0 ? (
        <p className={styles.swipeHint}>
          <span>
            Смахните дело <b>вправо</b> — готово, <b>влево</b> — на завтра
          </span>
          <button type="button" onClick={markSwipeLearned} aria-label="Понятно">
            ×
          </button>
        </p>
      ) : null}

      <AddTaskForm date={date} friends={friends} onCreate={onCreate} />
    </section>
  );
}

function summary(date: string, open: number, done: number): string {
  const today = todayKey();
  if (open === 0 && done === 0) {
    return date < today
      ? "В этот день ничего не было запланировано"
      : "Пока пусто — запиши дела, чтобы ничего не забыть";
  }
  if (open === 0) {
    return date === today ? "На сегодня всё выполнено 🎉" : "На этот день всё выполнено 🎉";
  }
  const left = `${open} ${plural(open)} в плане`;
  return done > 0 ? `${left} · ${done} уже сделано` : left;
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "дело";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дела";
  return "дел";
}
