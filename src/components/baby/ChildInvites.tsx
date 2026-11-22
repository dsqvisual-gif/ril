"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondChildInvite, type ChildInviteDTO } from "@/lib/actions/baby-care";
import styles from "./Baby.module.css";

/** "Ольга invites you to track Маша" — shown anywhere in the app until answered. */
export function ChildInvites({ invites }: { invites: ChildInviteDTO[] }) {
  const router = useRouter();
  const [left, setLeft] = useState(invites);
  const [busy, setBusy] = useState<string | null>(null);

  async function answer(id: string, accept: boolean) {
    setBusy(id);
    const result = await respondChildInvite(id, accept);
    setBusy(null);
    if (!result.ok) return;
    setLeft((prev) => prev.filter((i) => i.id !== id));
    if (accept) router.push("/app/baby");
    router.refresh();
  }

  if (left.length === 0) return null;
  return (
    <div className={styles.invites}>
      {left.map((invite) => (
        <div key={invite.id} className={styles.invite}>
          <p>
            👶 {invite.fromName ? <b>{invite.fromName}</b> : "Вас"} {invite.fromName ? "приглашает вас" : "пригласили"}{" "}
            отмечать малыша <b>{invite.childName}</b>: сон, кормления, прикорм.
          </p>
          <div className={styles.btnRow}>
            <button type="button" className={styles.bigBtn} disabled={busy === invite.id} onClick={() => void answer(invite.id, true)}>
              Принять
            </button>
            <button type="button" className={styles.softBtn} disabled={busy === invite.id} onClick={() => void answer(invite.id, false)}>
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
