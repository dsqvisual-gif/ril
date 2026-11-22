"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { addFriendFromLink, clearPendingFriend } from "@/lib/actions/friends";
import styles from "./FriendLinkPrompt.module.css";

export type FriendLinkTarget = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  /** "new" can be added; the rest only need the remembered link forgotten. */
  state: "new" | "incoming" | "sent" | "friends" | "self";
};

/** After opening someone's friend QR or link: "add them as a friend?" */
export function FriendLinkPrompt({ target }: { target: FriendLinkTarget }) {
  const router = useRouter();
  const [open, setOpen] = useState(target.state === "new" || target.state === "incoming");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target.state !== "new" && target.state !== "incoming") void clearPendingFriend();
  }, [target.state]);

  if (!open) return null;

  async function add() {
    setBusy(true);
    setError(null);
    const result = await addFriendFromLink(target.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(
      target.state === "incoming"
        ? `Вы с ${target.name} теперь друзья 🎉`
        : `Заявка отправлена — как только ${target.name} примет её, вы станете друзьями.`,
    );
    router.refresh();
  }

  async function dismiss() {
    setOpen(false);
    await clearPendingFriend();
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Добавить в друзья">
      <div className={styles.card}>
        <Avatar src={target.avatar} name={target.name} size={76} />
        <h2>{target.name}</h2>
        <p className={styles.nick}>@{target.username}</p>
        {done ? (
          <>
            <p className={styles.text}>{done}</p>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
              Отлично
            </button>
          </>
        ) : (
          <>
            <p className={styles.text}>
              {target.state === "incoming"
                ? `У вас уже есть заявка в друзья от ${target.name}. Принять?`
                : "Добавить в друзья? Сможете планировать общие дела вместе."}
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className="btn btn-ghost" onClick={() => void dismiss()} disabled={busy}>
                Не сейчас
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={busy}>
                {busy ? "Добавляю…" : target.state === "incoming" ? "Принять" : "Добавить в друзья"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
