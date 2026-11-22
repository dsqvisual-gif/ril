"use client";

import { useEffect } from "react";
import styles from "./UndoToast.module.css";

type Props = {
  text: string;
  /** Shows an "Отменить" button; leave out for a plain notice. */
  onUndo?: () => void;
  onClose: () => void;
  duration?: number;
};

/** A short notice at the bottom of the screen, with an undo button while it lasts. */
export function UndoToast({ text, onUndo, onClose, duration = 5000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div className={styles.toast} role="status">
      <span className={styles.text}>{text}</span>
      {onUndo ? (
        <button
          type="button"
          className={styles.undo}
          onClick={() => {
            onUndo();
            onClose();
          }}
        >
          Отменить
        </button>
      ) : (
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      )}
      <span className={styles.bar} style={{ animationDuration: `${duration}ms` }} aria-hidden />
    </div>
  );
}
