"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import type { TaskItemInput } from "@/lib/actions/tasks";
import { TASK_ITEM_MAX, TASK_ITEMS_MAX } from "@/lib/validation";
import styles from "./Checklist.module.css";

type Props = {
  items: TaskItemInput[];
  onChange: (items: TaskItemInput[]) => void;
};

/** Splits pasted or typed text into list lines: one per line, comma or semicolon. */
export function splitLines(text: string): string[] {
  const separator = /[\n;]/.test(text) ? /[\n;]/ : /,/;
  return text
    .split(separator)
    .map((line) => line.replace(/^\s*[-•*\d.)]+\s*/, "").trim())
    .filter(Boolean);
}

/** The checklist inside the task form: type a line and press Enter to add it. */
export function ChecklistEditor({ items, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const full = items.length >= TASK_ITEMS_MAX;

  function add(lines: string[]) {
    const room = TASK_ITEMS_MAX - items.length;
    if (lines.length === 0 || room <= 0) return;
    onChange([...items, ...lines.slice(0, room).map((text) => ({ text: text.slice(0, TASK_ITEM_MAX), done: false }))]);
    setDraft("");
    input.current?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Enter adds a line instead of submitting the whole form.
      event.preventDefault();
      add(draft.trim() ? [draft.trim()] : []);
    } else if (event.key === "Backspace" && !draft && items.length > 0) {
      onChange(items.slice(0, -1));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/[\n;,]/.test(text)) return;
    event.preventDefault();
    add(splitLines(draft + text));
  }

  return (
    <div className={styles.editor}>
      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((item, index) => (
            <li key={index} className={styles.item}>
              <input
                type="checkbox"
                className={styles.box}
                checked={Boolean(item.done)}
                aria-label="Отмечено"
                onChange={(e) =>
                  onChange(items.map((it, i) => (i === index ? { ...it, done: e.target.checked } : it)))
                }
              />
              <input
                className={styles.text}
                value={item.text}
                maxLength={TASK_ITEM_MAX}
                aria-label={`Пункт ${index + 1}`}
                onChange={(e) =>
                  onChange(items.map((it, i) => (i === index ? { ...it, text: e.target.value } : it)))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    input.current?.focus();
                  }
                }}
              />
              <button
                type="button"
                className={styles.remove}
                aria-label={`Убрать «${item.text}»`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {full ? (
        <p className={styles.hint}>В списке уже {TASK_ITEMS_MAX} пунктов — это максимум.</p>
      ) : (
        <div className={styles.addRow}>
          <span className={styles.plus} aria-hidden>
            +
          </span>
          <input
            ref={input}
            className={styles.addInput}
            value={draft}
            maxLength={TASK_ITEM_MAX}
            placeholder={items.length === 0 ? "Например: молоко — и Enter" : "Ещё пункт"}
            aria-label="Новый пункт списка"
            enterKeyHint="enter"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onPaste={onPaste}
            onBlur={() => {
              if (draft.trim()) add([draft.trim()]);
            }}
          />
        </div>
      )}
      {items.length === 0 ? (
        <p className={styles.hint}>
          Дело закроется само, когда отметите все пункты. Можно вставить готовый список целиком.
        </p>
      ) : null}
    </div>
  );
}
