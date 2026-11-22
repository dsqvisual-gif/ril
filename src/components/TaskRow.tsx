"use client";

import { useRef, useState, type FormEvent, type ReactNode, type TouchEvent } from "react";
import Image from "next/image";
import styles from "./TaskRow.module.css";
import listStyles from "./planner/Checklist.module.css";
import { TaskEditor } from "./AddTaskForm";
import { splitLines } from "./planner/ChecklistEditor";
import { markSwipeLearned } from "./planner/swipe-hint";
import type { CreateTaskInput, TaskDTO } from "@/lib/actions/tasks";
import type { FriendOption } from "@/lib/actions/friends";
import { TASK_ITEM_MAX, TASK_ITEMS_MAX } from "@/lib/validation";

export type TaskHandlers = {
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, input: CreateTaskInput) => Promise<void>;
  /** Moves the task one day later. */
  onPostpone: (id: string) => void;
  onItemToggle: (taskId: string, itemId: string) => void;
  onItemAdd: (taskId: string, text: string) => Promise<void>;
  onItemRemove: (taskId: string, itemId: string) => void;
};

type Props = TaskHandlers & {
  task: TaskDTO;
  friends: FriendOption[];
  busy?: boolean;
};

const SWIPE_AT = 76;

export function TaskRow({ task, friends, busy, ...handlers }: Props) {
  const { onToggle, onDelete, onUpdate, onPostpone } = handlers;
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; dragging: boolean; locked: boolean } | null>(null);

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
          note: task.note,
          items: task.items.map((item) => ({ text: item.text, done: item.done })),
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

  const items = task.items;
  const hasList = items.length > 0;
  const checked = items.filter((item) => item.done).length;
  const hasDetails = hasList || Boolean(task.note);
  const canPostpone = task.viewerIsOwner && !task.done;
  const withWhom = task.partners.map((person) => person.name).join(", ");
  const carried = !task.done && task.originDate < task.date;

  // A task with a list closes by itself once every item is checked.
  function check() {
    if (hasList && !task.done) {
      setOpen(true);
      setNudge(true);
      return;
    }
    onToggle(task.id);
  }

  function onTouchStart(event: TouchEvent) {
    if ((event.target as HTMLElement).closest("input, textarea, a, [data-noswipe]")) return;
    const t = event.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, dragging: false, locked: false };
  }

  function onTouchMove(event: TouchEvent) {
    const start = touch.current;
    if (!start || start.locked) return;
    const t = event.touches[0];
    const moveX = t.clientX - start.x;
    const moveY = t.clientY - start.y;
    if (!start.dragging) {
      if (Math.abs(moveY) > 10 && Math.abs(moveY) > Math.abs(moveX)) {
        start.locked = true; // the person is scrolling
        return;
      }
      if (Math.abs(moveX) < 12) return;
      start.dragging = true;
    }
    // Right is "to tomorrow", only for the author's open tasks: resist otherwise.
    const limited = moveX > 0 && !canPostpone ? moveX / 4 : moveX;
    const next = Math.max(-140, Math.min(140, limited));
    if (Math.abs(next) >= SWIPE_AT && Math.abs(dx) < SWIPE_AT) navigator.vibrate?.(8);
    setDx(next);
  }

  function onTouchEnd() {
    const start = touch.current;
    touch.current = null;
    if (!start?.dragging) return;
    const offset = dx;
    setDx(0);
    if (offset <= -SWIPE_AT) {
      markSwipeLearned();
      check();
    } else if (offset >= SWIPE_AT && canPostpone) {
      markSwipeLearned();
      onPostpone(task.id);
    }
  }

  const tone = [
    styles.row,
    task.done ? styles.done : "",
    task.urgent ? styles.urgent : task.important ? styles.important : "",
    dx !== 0 ? styles.dragging : "",
  ]
    .filter(Boolean)
    .join(" ");

  // A mascot peeks out from behind every important open task.
  const peek = task.important && !task.done;
  const swipeSide = dx < 0 ? "done" : dx > 0 ? "later" : null;
  const ready = Math.abs(dx) >= SWIPE_AT && (dx < 0 || canPostpone);

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
      <div className={dx !== 0 ? `${styles.swipe} ${styles.swipeActive}` : styles.swipe}>
        {swipeSide ? (
          <div
            className={`${styles.swipeBg} ${swipeSide === "done" ? styles.swipeDone : styles.swipeLater} ${ready ? styles.swipeReady : ""}`}
            aria-hidden
          >
            {swipeSide === "done" ? (
              <span>{task.done ? "Вернуть ↺" : hasList ? "Список ☑" : "Готово ✓"}</span>
            ) : (
              <span className={styles.swipeRight}>{canPostpone ? "На завтра →" : "Нельзя перенести"}</span>
            )}
          </div>
        ) : null}
        <div
          className={tone}
          style={dx !== 0 ? { transform: `translateX(${dx}px)` } : undefined}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => {
            touch.current = null;
            setDx(0);
          }}
        >
          <div className={styles.line}>
            <button
              type="button"
              className={styles.check}
              aria-label={
                task.done ? "Снять отметку" : hasList ? "Открыть список" : "Выполнить"
              }
              disabled={busy}
              onClick={check}
            >
              <span className={styles.dot}>
                {task.done ? "✓" : hasList && checked > 0 ? <Ring part={checked / items.length} /> : ""}
              </span>
            </button>
            <div
              className={hasDetails ? `${styles.body} ${styles.bodyOpenable}` : styles.body}
              onClick={hasDetails ? () => setOpen((value) => !value) : undefined}
              role={hasDetails ? "button" : undefined}
              tabIndex={hasDetails ? 0 : undefined}
              aria-expanded={hasDetails ? open : undefined}
              onKeyDown={
                hasDetails
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen((value) => !value);
                      }
                    }
                  : undefined
              }
            >
              <p className={open ? `${styles.title} ${styles.titleFull}` : styles.title}>{task.title}</p>
              {task.important ||
              task.urgent ||
              task.time ||
              task.shared ||
              carried ||
              hasDetails ? (
                <div className={styles.meta}>
                  {task.urgent ? <span className={styles.urgentFlag}>Срочно</span> : null}
                  {task.important ? <span className={styles.importantFlag}>Важно</span> : null}
                  {task.time ? <span className={styles.time}>{task.time}</span> : null}
                  {hasList ? (
                    <span className={checked === items.length ? styles.listDone : styles.listChip}>
                      ☑ {checked}/{items.length}
                    </span>
                  ) : null}
                  {task.note ? <span className={styles.noteChip}>✎ заметка</span> : null}
                  {carried ? <span className={styles.carried}>перенесено</span> : null}
                  {task.shared && !task.viewerIsOwner && task.ownerName ? (
                    <span className={styles.shared}>от {task.ownerName}</span>
                  ) : null}
                  {withWhom ? <span className={styles.shared}>с {withWhom}</span> : null}
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
                  title="Удалить"
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

          {open && hasDetails ? (
            <div className={styles.details} data-noswipe>
              {hasList ? (
                <LiveChecklist
                  task={task}
                  nudge={nudge}
                  onToggle={(itemId) => {
                    setNudge(false);
                    handlers.onItemToggle(task.id, itemId);
                  }}
                  onAdd={(text) => handlers.onItemAdd(task.id, text)}
                  onRemove={(itemId) => handlers.onItemRemove(task.id, itemId)}
                />
              ) : null}
              {task.note ? <p className={styles.note}>{linkify(task.note)}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Ring({ part }: { part: number }) {
  const r = 9;
  const length = 2 * Math.PI * r;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className={styles.ring}>
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke="var(--success)"
        strokeWidth="3"
        strokeDasharray={`${length * part} ${length}`}
        strokeLinecap="round"
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}

function LiveChecklist({
  task,
  nudge,
  onToggle,
  onAdd,
  onRemove,
}: {
  task: TaskDTO;
  nudge: boolean;
  onToggle: (itemId: string) => void;
  onAdd: (text: string) => Promise<void>;
  onRemove: (itemId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const items = task.items;
  const checked = items.filter((item) => item.done).length;
  const left = items.length - checked;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const lines = splitLines(draft);
    if (lines.length === 0 || saving) return;
    setSaving(true);
    try {
      await onAdd(lines.join("\n"));
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={listStyles.live}>
      <div className={listStyles.progress} aria-hidden>
        <span style={{ width: `${(checked / items.length) * 100}%` }} />
      </div>
      {nudge && left > 0 ? (
        <p className={styles.nudge}>
          Отметьте все пункты — дело закроется само. Осталось {left}.
        </p>
      ) : null}
      <ul className={listStyles.list}>
        {items.map((item) => (
          <li key={item.id} className={item.done ? `${listStyles.liveItem} ${listStyles.liveDone}` : listStyles.liveItem}>
            <button
              type="button"
              className={listStyles.liveBox}
              role="checkbox"
              aria-checked={item.done}
              aria-label={item.text}
              onClick={() => onToggle(item.id)}
            >
              {item.done ? "✓" : ""}
            </button>
            <span className={listStyles.liveText} onClick={() => onToggle(item.id)}>
              {item.text}
            </span>
            <button
              type="button"
              className={listStyles.remove}
              aria-label={`Убрать «${item.text}»`}
              onClick={() => onRemove(item.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {items.length < TASK_ITEMS_MAX ? (
        <form className={listStyles.addRow} onSubmit={submit}>
          <span className={listStyles.plus} aria-hidden>
            +
          </span>
          <input
            className={listStyles.addInput}
            value={draft}
            maxLength={TASK_ITEM_MAX * 4}
            placeholder="Добавить пункт"
            aria-label="Добавить пункт"
            enterKeyHint="done"
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
      ) : null}
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s]+)/g;

function linkify(text: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
