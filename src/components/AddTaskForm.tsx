"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import styles from "./AddTaskForm.module.css";
import type { CreateTaskInput } from "@/lib/actions/tasks";
import type { FriendOption } from "@/lib/actions/friends";

type Props = {
  date: string;
  friends: FriendOption[];
  onCreate: (input: CreateTaskInput) => Promise<void>;
};

export function AddTaskForm({ date, friends, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [withTime, setWithTime] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [important, setImportant] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFriend(id: string) {
    setFriendIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        date,
        time: withTime && time ? time : null,
        important,
        urgent,
        friendIds,
      });
      setTitle("");
      setTime("");
      setWithTime(false);
      setImportant(false);
      setUrgent(false);
      setFriendIds([]);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.addBtn} onClick={() => setOpen(true)}>
        <span className={styles.plus}>+</span>
        Новое дело
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="task-title">Что сделать</label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: созвон с командой"
          autoFocus
          required
        />
      </div>

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
          <label htmlFor="task-time">Время</label>
          <input
            id="task-time"
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
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Сохраняю…" : "Добавить"}
        </button>
      </div>
    </form>
  );
}
