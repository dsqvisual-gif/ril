"use client";

import { useState, type InputHTMLAttributes } from "react";
import styles from "./PasswordInput.module.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password field with an eye button that shows or hides what was typed. */
export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.wrap}>
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className={styles.eye}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={visible}
        title={visible ? "Скрыть пароль" : "Показать пароль"}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.5-2.4 3.7M6.6 6.6C4.6 7.9 3.2 9.9 2.5 12c1 2.8 4.5 7 9.5 7 1.7 0 3.2-.5 4.5-1.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M2.5 12C3.5 9.2 7 5 12 5s8.5 4.2 9.5 7c-1 2.8-4.5 7-9.5 7s-8.5-4.2-9.5-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
