"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  createCompanyTask,
  deleteCompanyTask,
  updateCompanyTask,
  type CompanyTaskDTO,
  type CompanyTaskStatus,
  type CompanyView,
} from "@/lib/actions/company";
import { todayKey } from "@/lib/dates";
import type { RunView } from "./TeamApp";
import { deadlineInfo, initials, personName } from "./team-utils";
import styles from "./Team.module.css";

const COLUMNS: { status: CompanyTaskStatus; label: string }[] = [
  { status: "todo", label: "Не начато" },
  { status: "doing", label: "В процессе" },
  { status: "done", label: "Готово" },
];

type Props = {
  view: CompanyView;
  busy: string | null;
  run: RunView;
};

export function TeamTasks({ view, busy, run }: Props) {
  const manager = view.me.role === "owner" || view.me.role === "admin";
  // Members start with their own tasks; admins see the whole board.
  const [filter, setFilter] = useState<string>(manager ? "all" : view.me.userId);
  const active = view.members.filter((m) => m.status === "active");

  const tasks = useMemo(() => {
    if (filter === "all") return view.tasks;
    if (filter === "none") return view.tasks.filter((t) => !t.assigneeId);
    return view.tasks.filter((t) => t.assigneeId === filter);
  }, [view.tasks, filter]);

  return (
    <div className={styles.panel}>
      {manager ? (
        <NewTaskForm view={view} busy={busy === "task:new"} run={run} />
      ) : (
        <p className={styles.memberHint}>
          Задачи раздают администраторы. Отмечайте у своих задач, как идёт работа: не начато, в процессе
          или готово.
        </p>
      )}

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Чьи задачи показать"
        >
          <option value="all">Все задачи · {view.tasks.length}</option>
          <option value={view.me.userId}>
            Мои · {view.tasks.filter((t) => t.assigneeId === view.me.userId).length}
          </option>
          {active
            .filter((m) => m.userId !== view.me.userId)
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name} · {view.tasks.filter((t) => t.assigneeId === m.userId).length}
              </option>
            ))}
          <option value="none">Без исполнителя</option>
        </select>
      </div>

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.status);
          return (
            <section key={col.status} className={styles.column} data-status={col.status}>
              <h3 className={styles.columnTitle}>
                {col.label} <span>{items.length}</span>
              </h3>
              {items.length === 0 ? <p className={styles.columnEmpty}>Пусто</p> : null}
              {items.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  view={view}
                  canEdit={manager}
                  canMove={manager || task.assigneeId === view.me.userId}
                  busy={busy === task.id}
                  run={run}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function NewTaskForm({ view, busy, run }: { view: CompanyView; busy: boolean; run: RunView }) {
  const active = view.members.filter((m) => m.status === "active");
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [important, setImportant] = useState(false);
  const [note, setNote] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const ok = await run(
      "task:new",
      () =>
        createCompanyTask(view.company.id, {
          title,
          note,
          assigneeId: assigneeId || null,
          startDate: startDate || null,
          deadline: deadline || null,
          important,
        }),
      "Не удалось добавить задачу",
    );
    if (ok) {
      setTitle("");
      setNote("");
      setStartDate("");
      setDeadline("");
      setImportant(false);
    }
  }

  return (
    <form className={styles.taskForm} onSubmit={submit}>
      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Новая задача для команды"
        maxLength={140}
        aria-label="Задача"
      />
      <div className={styles.taskFormGrid}>
        <label className={styles.label}>
          Исполнитель
          <select
            className={styles.select}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Не назначен</option>
            {active.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userId === view.me.userId ? `${m.name} (я)` : m.name}
                {m.username ? ` · @${m.username}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Начало
          <input
            className={styles.input}
            type="date"
            value={startDate}
            max={deadline || undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          Дедлайн
          <input
            className={styles.input}
            type="date"
            value={deadline}
            min={startDate || todayKey()}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
      </div>
      <textarea
        className={styles.textarea}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Подробности (необязательно)"
        maxLength={1000}
        rows={2}
        aria-label="Описание"
      />
      <div className={styles.taskFormFoot}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={important}
            onChange={(e) => setImportant(e.target.checked)}
          />
          Важная
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
          Добавить задачу
        </button>
      </div>
    </form>
  );
}

function TaskCard({
  task,
  view,
  canEdit,
  canMove,
  busy,
  run,
}: {
  task: CompanyTaskDTO;
  view: CompanyView;
  canEdit: boolean;
  canMove: boolean;
  busy: boolean;
  run: RunView;
}) {
  const [open, setOpen] = useState(false);
  const active = view.members.filter((m) => m.status === "active");
  const assignee = view.members.find((m) => m.userId === task.assigneeId);
  const due = deadlineInfo(task.deadline, task.status === "done");

  function patch(data: Parameters<typeof updateCompanyTask>[1], fallback: string) {
    void run(task.id, () => updateCompanyTask(task.id, data), fallback);
  }

  return (
    <article className={`${styles.card} ${task.important ? styles.cardImportant : ""}`}>
      <button type="button" className={styles.cardMain} onClick={() => setOpen((v) => !v)}>
        <p className={styles.cardTitle}>{task.title}</p>
        <div className={styles.cardMeta}>
          {task.important ? <span className={styles.flag}>Важно</span> : null}
          {due ? <span className={`${styles.due} ${styles[due.tone]}`}>{due.text}</span> : null}
        </div>
        <div className={styles.assignee}>
          {assignee ? (
            <>
              <span className={styles.avatar}>{initials(assignee.name)}</span>
              {personName(assignee, view.me.userId)}
            </>
          ) : (
            <span className={styles.muted}>Без исполнителя</span>
          )}
        </div>
      </button>

      {canMove ? (
        <div className={styles.statusRow} role="group" aria-label="Статус">
          {COLUMNS.map((col) => (
            <button
              key={col.status}
              type="button"
              className={task.status === col.status ? styles.statusActive : undefined}
              disabled={busy || task.status === col.status}
              onClick={() => patch({ status: col.status }, "Не удалось сменить статус")}
            >
              {col.label}
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className={styles.cardDetails}>
          {task.note ? <p className={styles.note}>{task.note}</p> : null}
          {canEdit ? (
            <>
              <label className={styles.label}>
                Исполнитель
                <select
                  className={styles.select}
                  value={task.assigneeId ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    patch({ assigneeId: e.target.value || null }, "Не удалось назначить")
                  }
                >
                  <option value="">Не назначен</option>
                  {active.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {personName(m, view.me.userId)}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.twoCols}>
                <label className={styles.label}>
                  Начало
                  <input
                    className={styles.input}
                    type="date"
                    value={task.startDate}
                    disabled={busy}
                    onChange={(e) => patch({ startDate: e.target.value || null }, "Не удалось")}
                  />
                </label>
                <label className={styles.label}>
                  Дедлайн
                  <input
                    className={styles.input}
                    type="date"
                    value={task.deadline ?? ""}
                    disabled={busy}
                    onChange={(e) => patch({ deadline: e.target.value || null }, "Не удалось")}
                  />
                </label>
              </div>
              <div className={styles.cardFoot}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={task.important}
                    disabled={busy}
                    onChange={(e) => patch({ important: e.target.checked }, "Не удалось")}
                  />
                  Важная
                </label>
                <button
                  type="button"
                  className={styles.dangerLink}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Удалить задачу «${task.title}»?`)) {
                      void run(task.id, () => deleteCompanyTask(task.id), "Не удалось удалить");
                    }
                  }}
                >
                  Удалить
                </button>
              </div>
            </>
          ) : (
            <p className={styles.muted}>Менять задачу могут владелец и администраторы.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
