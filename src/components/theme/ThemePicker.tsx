"use client";

import { useState } from "react";
import { saveTheme } from "@/lib/actions/theme";
import { THEMES, type ThemeId } from "@/lib/themes";
import styles from "./ThemePicker.module.css";

/** Repaints the page in the chosen theme right away. */
function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
}

export function ThemePicker({ initial }: { initial: ThemeId }) {
  const [theme, setTheme] = useState<ThemeId>(initial);

  function pick(id: ThemeId) {
    setTheme(id);
    applyTheme(id);
    void saveTheme(id);
  }

  return (
    <div className={styles.grid} role="radiogroup" aria-label="Оформление">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          className={`${styles.option} ${theme === t.id ? styles.active : ""}`}
          onClick={() => pick(t.id)}
        >
          <span
            className={styles.preview}
            style={{ background: t.swatch[0] }}
            aria-hidden
          >
            <span className={styles.card} style={{ background: t.swatch[1] }}>
              <i style={{ background: t.swatch[2] }} />
              <i />
            </span>
          </span>
          <span className={styles.name}>{t.name}</span>
        </button>
      ))}
    </div>
  );
}
