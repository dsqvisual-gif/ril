"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./AddTaskForm.module.css";
import type { CreateTaskInput } from "@/lib/actions/tasks";
import type { FriendOption } from "@/lib/actions/friends";
import { TASK_TITLE_MAX } from "@/lib/validation";
import { errorText } from "@/lib/action-result";

type Props = {
  date: string;
  friends: FriendOption[];
  onCreate: (input: CreateTaskInput) => Promise<void>;
};

export function AddTaskForm({ date, friends, onCreate }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className={styles.addBtn} onClick={() => setOpen(true)}>
        <span className={styles.plus}>+</span>
        Новое дело
      </button>
    );
  }

  return (
    <TaskEditor
      friends={friends}
      initial={{ date }}
      submitLabel="Добавить"
      onSubmit={async (input) => {
        await onCreate(input);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

type EditorProps = {
  friends: FriendOption[];
  initial: Partial<CreateTaskInput> & { date: string };
  /** Shows a date field, for moving a task to another day. */
  withDate?: boolean;
  submitLabel: string;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
  onCancel: () => void;
};

/** Fields of a task, shared by the "new task" form and task editing. */
export function TaskEditor({
  friends,
  initial,
  withDate = false,
  submitLabel,
  onSubmit,
  onCancel,
}: EditorProps) {
  const id = useId();
  const [title, setTitle] = useState(initial.title ?? "");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time ?? "");
  const [withTime, setWithTime] = useState(Boolean(initial.time));
  const [friendIds, setFriendIds] = useState<string[]>(initial.friendIds ?? []);
  const [important, setImportant] = useState(Boolean(initial.important));
  const [urgent, setUrgent] = useState(Boolean(initial.urgent));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFriend(friendId: string) {
    setFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((item) => item !== friendId) : [...prev, friendId],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        date,
        time: withTime && time ? time : null,
        important,
        urgent,
        friendIds,
      });
    } catch (err) {
      setError(errorText(err, "Не удалось сохранить"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={`${id}-title`}>Что сделать</label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: созвон с командой"
          maxLength={TASK_TITLE_MAX}
          autoFocus
          required
        />
      </div>

      {withDate ? (
        <div className="field">
          <label htmlFor={`${id}-date`}>День</label>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || date)}
            required
          />
        </div>
      ) : null}

      <div className={styles.flags}>
        <button
          type="button"
          className={important ? styles.importantOn : styles.flag}
          aria-pressed={important}
          onClick={() => setImportant((value) => !value)}
        >
          Важно
        </button>
        <button
          type="button"
          className={urgent ? styles.urgentOn : styles.flag}
          aria-pressed={urgent}
          onClick={() => setUrgent((value) => !value)}
        >
          Срочно
        </button>
      </div>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={withTime}
          onChange={(e) => setWithTime(e.target.checked)}
        />
        Указать время
      </label>

      {withTime ? (
        <div className="field">
          <label htmlFor={`${id}-time`}>Время</label>
          <input
            id={`${id}-time`}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      ) : null}

      {friends.length > 0 ? (
        <fieldset className={styles.friends}>
          <legend>Совместно с</legend>
          <div className={styles.chips}>
            {friends.map((friend) => {
              const selected = friendIds.includes(friend.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  className={selected ? styles.chipOn : styles.chip}
                  aria-pressed={selected}
                  onClick={() => toggleFriend(friend.id)}
                >
                  {friend.alias || `@${friend.username}`}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className={styles.hint}>
          <Link href="/app/friends">Добавьте друзей</Link>, чтобы делать совместные дела
        </p>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={pending}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Сохраняю…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
