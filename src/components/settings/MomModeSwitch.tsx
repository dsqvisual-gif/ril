"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMomMode } from "@/lib/actions/baby";
import styles from "./Settings.module.css";

/** Turns mom mode on or off and opens the matching home screen. */
export function MomModeSwitch({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setOn(next);
    setPending(true);
    setError(null);
    const result = await setMomMode(next);
    setPending(false);
    if (!result.ok) {
      setOn(!next);
      setError(result.error);
      return;
    }
    router.push(next ? "/app/baby" : "/app");
  }

  return (
    <div className={`${styles.card} ${styles.momCard}`}>
      <label className={styles.switchRow}>
        <span>
          <b>🤱 Режим мамы</b>
          <small>
            Трекер малыша: сон, кормления, подгузники, прикорм, рост и вес — и статистика. Личный
            планер остаётся рядом. Меню становится короче, оформление — мягче.
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className={styles.switch}
          checked={on}
          disabled={pending}
          onChange={(e) => void toggle(e.target.checked)}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
