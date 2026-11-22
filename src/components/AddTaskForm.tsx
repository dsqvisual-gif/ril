"use client";

import { useId, useState, type FormEvent } from "react";
import styles from "./AddTaskForm.module.css";
import type { CreateTaskInput, TaskItemInput } from "@/lib/actions/tasks";
import type { FriendOption } from "@/lib/actions/friends";
import { TASK_NOTE_MAX, TASK_TITLE_MAX } from "@/lib/validation";
import { ChecklistEditor } from "./planner/ChecklistEditor";
import { FriendPicker, friendLabel } from "./planner/FriendPicker";
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
      <button
        type="button"
        className={styles.addBtn}
        onClick={() => setOpen(true)}
      >
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
  const [note, setNote] = useState(initial.note ?? "");
  const [withNote, setWithNote] = useState(Boolean(initial.note));
  const [items, setItems] = useState<TaskItemInput[]>(initial.items ?? []);
  const [withList, setWithList] = useState((initial.items?.length ?? 0) > 0);
  const [pickingFriends, setPickingFriends] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFriend(friendId: string) {
    setFriendIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((item) => item !== friendId)
        : [...prev, friendId],
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
        note: withNote ? note.trim() || null : null,
        items: withList ? items.filter((item) => item.text.trim()) : [],
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

      <div className={styles.priority}>
        <span className={styles.groupLabel}>Приоритет</span>
        <div className={styles.flags}>
          <button
            type="button"
            className={important ? styles.importantOn : styles.flag}
            aria-pressed={important}
            onClick={() => setImportant((value) => !value)}
          >
            <span className={styles.dotWarn} aria-hidden />
            Важно
          </button>
          <button
            type="button"
            className={urgent ? styles.urgentOn : styles.flag}
            aria-pressed={urgent}
            onClick={() => setUrgent((value) => !value)}
          >
            <span className={styles.dotDanger} aria-hidden />
            Срочно
          </button>
        </div>
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

      <div className={styles.addGroup}>
        <span className={styles.groupLabel}>Добавить к делу</span>
        <div className={styles.extras}>
          <button
            type="button"
            className={
              friendIds.length > 0 || pickingFriends
                ? styles.extraOn
                : styles.extra
            }
            aria-expanded={pickingFriends}
            onClick={() => setPickingFriends((value) => !value)}
          >
            <span className={styles.extraIcon} aria-hidden>
              👥
            </span>
            <span>
              {friendIds.length > 0
                ? `С друзьями · ${friendIds.length}`
                : "С другом"}
            </span>
          </button>
          <button
            type="button"
            className={withList ? styles.extraOn : styles.extra}
            aria-pressed={withList}
            onClick={() => setWithList((value) => !value)}
          >
            <span className={styles.extraIcon} aria-hidden>
              ☑️
            </span>
            <span>
              {withList && items.length > 0
                ? `Список · ${items.length}`
                : "Список"}
            </span>
          </button>
          <button
            type="button"
            className={withNote ? styles.extraOn : styles.extra}
            aria-pressed={withNote}
            onClick={() => setWithNote((value) => !value)}
          >
            <span className={styles.extraIcon} aria-hidden>
              📝
            </span>
            <span>Заметка</span>
          </button>
        </div>
      </div>

      {pickingFriends ? (
        <FriendPicker
          friends={friends}
          selected={friendIds}
          onToggle={toggleFriend}
          onDone={() => setPickingFriends(false)}
        />
      ) : friendIds.length > 0 ? (
        <div className={styles.chips}>
          {friendIds.map((friendId) => {
            const friend = friends.find((f) => f.id === friendId);
            return (
              <button
                key={friendId}
                type="button"
                className={styles.chipOn}
                onClick={() => toggleFriend(friendId)}
                aria-label={`Убрать ${friend ? friendLabel(friend) : "друга"}`}
              >
                {friend ? friendLabel(friend) : "друг"} ×
              </button>
            );
          })}
        </div>
      ) : null}

      {withList ? (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Список</span>
          <ChecklistEditor items={items} onChange={setItems} />
        </div>
      ) : null}

      {withNote ? (
        <div className="field">
          <label htmlFor={`${id}-note`}>Заметка</label>
          <textarea
            id={`${id}-note`}
            className={styles.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Адрес, телефон, ссылка — всё, что пригодится"
            maxLength={TASK_NOTE_MAX}
            rows={3}
          />
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={pending}
        >
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Сохраняю…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
