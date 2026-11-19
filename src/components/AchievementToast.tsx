"use client";

import { useEffect } from "react";
import styles from "./AchievementToast.module.css";

type Props = {
  title: string;
  onClose: () => void;
};

export function AchievementToast({ title, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={styles.toast} role="status">
      <span className={styles.badge}>★</span>
      <div>
        <p className={styles.label}>Новое достижение</p>
        <p className={styles.title}>{title}</p>
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}
