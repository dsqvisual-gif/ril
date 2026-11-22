"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { renameMe } from "@/lib/actions/account";
import styles from "./Settings.module.css";

/** The "Имя" value in the profile, editable in place. */
export function NameEditor({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (draft.trim() === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await renameMe(draft);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName(result.data);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <span className={styles.nameRow}>
        {name}
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          Изменить
        </button>
      </span>
    );
  }

  return (
    <form className={styles.nameForm} onSubmit={save}>
      <input
        className={styles.input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={80}
        minLength={2}
        required
        autoFocus
        aria-label="Имя"
        autoComplete="name"
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <div className={styles.nameActions}>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || draft.trim().length < 2}>
          {busy ? "Сохраняю…" : "Сохранить"}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <p className={styles.hint}>Так вас видят друзья и команда, если они не дали вам своё имя.</p>
    </form>
  );
}
