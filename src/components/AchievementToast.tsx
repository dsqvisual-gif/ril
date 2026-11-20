"use client";

import { useEffect } from "react";
import styles from "./AchievementToast.module.css";

type Props = {
  title: string;
  onClose: () => void;
  /** "error" shows a failure message instead of an unlocked achievement. */
  kind?: "achievement" | "error";
};

export function AchievementToast({ title, onClose, kind = "achievement" }: Props) {
  const error = kind === "error";
  useEffect(() => {
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`${styles.toast} ${error ? styles.error : ""}`} role={error ? "alert" : "status"}>
      <span className={styles.badge}>{error ? "!" : "★"}</span>
      <div>
        <p className={styles.label}>{error ? "Не получилось" : "Новое достижение"}</p>
        <p className={styles.title}>{title}</p>
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}
