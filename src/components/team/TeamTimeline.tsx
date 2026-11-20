"use client";

import { useMemo, useState } from "react";
import { format, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import type { CompanyTaskDTO, CompanyView } from "@/lib/actions/company";
import { fromDateKey, shiftDateKey, toDateKey, todayKey } from "@/lib/dates";
import { initials, isOverdue, personName } from "./team-utils";
import styles from "./Team.module.css";

const DAYS = 14;

type Row = {
  key: string;
  label: string;
  avatar: string | null;
  tasks: CompanyTaskDTO[];
};

export function TeamTimeline({ view }: { view: CompanyView }) {
  const today = todayKey();
  const [start, setStart] = useState(() =>
    toDateKey(startOfWeek(fromDateKey(today), { weekStartsOn: 1 })),
  );
  const [showDone, setShowDone] = useState(false);

  const days = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => shiftDateKey(start, i)),
    [start],
  );
  const end = days[days.length - 1];
  const active = view.members.filter((m) => m.status === "active");

  const rows: Row[] = useMemo(() => {
    const visible = view.tasks.filter((t) => {
      if (!showDone && t.status === "done") return false;
      const last = t.deadline ?? t.startDate;
      return t.startDate <= end && last >= start;
    });
    const byPerson: Row[] = active.map((m) => ({
      key: m.userId,
      label: personName(m, view.me.userId),
      avatar: initials(m.name),
      tasks: visible.filter((t) => t.assigneeId === m.userId),
    }));
    const unassigned = visible.filter((t) => !t.assigneeId);
    if (unassigned.length > 0) {
      byPerson.push({ key: "none", label: "Без исполнителя", avatar: null, tasks: unassigned });
    }
    return byPerson;
  }, [view.tasks, view.me.userId, active, showDone, start, end]);

  return (
    <div className={styles.panel}>
      <Workload view={view} />

      <div className={styles.timelineBar}>
        <div className={styles.navGroup}>
          <button type="button" onClick={() => setStart((s) => shiftDateKey(s, -7))} aria-label="Раньше">
            ‹
          </button>
          <button
            type="button"
            onClick={() =>
              setStart(toDateKey(startOfWeek(fromDateKey(today), { weekStartsOn: 1 })))
            }
          >
            Сегодня
          </button>
          <button type="button" onClick={() => setStart((s) => shiftDateKey(s, 7))} aria-label="Позже">
            ›
          </button>
        </div>
        <span className={styles.rangeLabel}>
          {format(fromDateKey(start), "d MMM", { locale: ru })} —{" "}
          {format(fromDateKey(end), "d MMM yyyy", { locale: ru })}
        </span>
        <label className={styles.toggle}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Показывать готовые
        </label>
      </div>

      <div className={styles.ganttScroll}>
        <div className={styles.gantt} style={{ ["--days" as string]: DAYS }}>
          <div className={styles.ganttCorner}>Кто</div>
          {days.map((day) => {
            const date = fromDateKey(day);
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <div
                key={day}
                className={`${styles.ganttDay} ${weekend ? styles.weekend : ""} ${day === today ? styles.todayCol : ""}`}
              >
                <span>{format(date, "EEEEEE", { locale: ru })}</span>
                <b>{format(date, "d")}</b>
              </div>
            );
          })}

          {rows.map((row, index) => {
            // Row 1 is the day header; each person takes one grid row per task.
            const startRow =
              2 + rows.slice(0, index).reduce((sum, r) => sum + Math.max(1, r.tasks.length), 0);
            return (
              <GanttRow key={row.key} row={row} days={days} today={today} startRow={startRow} />
            );
          })}
        </div>
        {rows.every((r) => r.tasks.length === 0) ? (
          <p className={styles.ganttEmpty}>
            На эти две недели задач с датами нет. Укажите у задач начало и дедлайн — они появятся
            здесь полосками.
          </p>
        ) : null}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendTodo}>к работе</span>
        <span className={styles.legendDoing}>в работе</span>
        <span className={styles.legendDone}>готово</span>
        <span className={styles.legendLate}>просрочено</span>
      </div>
    </div>
  );
}

function GanttRow({
  row,
  days,
  today,
  startRow,
}: {
  row: Row;
  days: string[];
  today: string;
  startRow: number;
}) {
  const first = days[0];
  const last = days[days.length - 1];
  const lanes = Math.max(1, row.tasks.length);

  return (
    <>
      <div
        className={styles.ganttPerson}
        style={{ gridColumn: 1, gridRow: `${startRow} / span ${lanes}` }}
      >
        {row.avatar ? <span className={styles.avatar}>{row.avatar}</span> : null}
        <span className={styles.ganttName}>{row.label}</span>
      </div>
      {row.tasks.length === 0 ? (
        <div
          className={`${styles.ganttLane} ${styles.ganttLaneLast}`}
          style={{ gridColumn: `2 / span ${days.length}`, gridRow: startRow }}
        >
          <span className={styles.ganttFree}>свободен</span>
        </div>
      ) : (
        row.tasks.map((task, lane) => {
          const from = task.startDate < first ? first : task.startDate;
          const endKey = task.deadline ?? task.startDate;
          const to = endKey > last ? last : endKey;
          const startIdx = days.indexOf(from);
          const endIdx = days.indexOf(to);
          const tone = isOverdue(task, today)
            ? styles.barLate
            : task.status === "done"
              ? styles.barDone
              : task.status === "doing"
                ? styles.barDoing
                : styles.barTodo;
          return (
            <div
              key={task.id}
              className={`${styles.ganttLane} ${lane === row.tasks.length - 1 ? styles.ganttLaneLast : ""}`}
              style={{ gridColumn: `2 / span ${days.length}`, gridRow: startRow + lane }}
            >
              <div
                className={`${styles.bar} ${tone} ${task.startDate < first ? styles.barCutStart : ""} ${endKey > last ? styles.barCutEnd : ""}`}
                style={{
                  gridColumn: `${startIdx + 1} / ${endIdx + 2}`,
                }}
                title={`${task.title}${task.deadline ? ` · дедлайн ${format(fromDateKey(task.deadline), "d MMM", { locale: ru })}` : ""}`}
              >
                {task.important ? "★ " : ""}
                {task.title}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

function Workload({ view }: { view: CompanyView }) {
  const today = todayKey();
  const active = view.members.filter((m) => m.status === "active");

  return (
    <div className={styles.workload}>
      {active.map((m) => {
        const mine = view.tasks.filter((t) => t.assigneeId === m.userId);
        const late = mine.filter((t) => isOverdue(t, today)).length;
        const doing = mine.filter((t) => t.status === "doing").length;
        const todo = mine.filter((t) => t.status === "todo").length;
        const done = mine.filter((t) => t.status === "done").length;
        const total = Math.max(1, mine.length);
        return (
          <article key={m.userId} className={styles.loadCard}>
            <div className={styles.loadHead}>
              <span className={styles.avatar}>{initials(m.name)}</span>
              <span className={styles.loadName}>{personName(m, view.me.userId)}</span>
            </div>
            <div className={styles.loadBar} aria-hidden>
              <span className={styles.segDone} style={{ flexGrow: done / total }} />
              <span className={styles.segDoing} style={{ flexGrow: doing / total }} />
              <span className={styles.segTodo} style={{ flexGrow: todo / total }} />
            </div>
            <p className={styles.loadStats}>
              {doing} в работе · {todo} к работе · {done} готово
              {late > 0 ? <b className={styles.lateText}> · {late} просроч.</b> : null}
            </p>
          </article>
        );
      })}
    </div>
  );
}
