"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { searchTasks, type SearchHit } from "@/lib/actions/tasks";
import { fromDateKey, relativeDayName, todayKey } from "@/lib/dates";
import styles from "./TaskSearch.module.css";

type Props = {
  onPick: (date: string) => void;
  onClose: () => void;
};

/** Finds tasks by title, note or list item, across all days. */
export function TaskSearch({ onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      const result = await searchTasks(trimmed);
      if (ticket !== latest.current) return;
      if (result.ok) {
        setHits(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [trimmed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = trimmed.length >= 2 ? hits : null;
  const today = todayKey();
  const upcoming = shown?.filter((hit) => hit.date >= today).reverse() ?? [];
  const past = shown?.filter((hit) => hit.date < today) ?? [];

  return (
    <section className={styles.panel} aria-label="Поиск по делам">
      <div className={styles.bar}>
        <SearchIcon />
        <input
          className={styles.input}
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти дело, заметку или пункт списка"
          aria-label="Что найти"
          autoFocus
          enterKeyHint="search"
        />
        <button type="button" className={styles.close} onClick={onClose}>
          Закрыть
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {trimmed.length < 2 ? (
        <p className={styles.hint}>Например: «врач», «молоко» или имя друга в названии дела.</p>
      ) : shown && shown.length === 0 ? (
        <p className={styles.hint}>Ничего не нашлось по «{trimmed}».</p>
      ) : shown ? (
        <div className={styles.groups}>
          {upcoming.length > 0 ? (
            <Group title="Сегодня и дальше" hits={upcoming} query={trimmed} onPick={onPick} />
          ) : null}
          {past.length > 0 ? <Group title="Было" hits={past} query={trimmed} onPick={onPick} /> : null}
        </div>
      ) : (
        <p className={styles.hint}>Ищу…</p>
      )}
    </section>
  );
}

function Group({
  title,
  hits,
  query,
  onPick,
}: {
  title: string;
  hits: SearchHit[];
  query: string;
  onPick: (date: string) => void;
}) {
  return (
    <div>
      <h3 className={styles.groupTitle}>{title}</h3>
      <ul className={styles.list}>
        {hits.map((hit) => (
          <li key={hit.id}>
            <button type="button" className={styles.hit} onClick={() => onPick(hit.date)}>
              <span className={hit.done ? `${styles.mark} ${styles.markDone}` : styles.mark}>
                {hit.done ? "✓" : ""}
              </span>
              <span className={styles.hitBody}>
                <span className={hit.done ? `${styles.hitTitle} ${styles.hitTitleDone}` : styles.hitTitle}>
                  <Highlight text={hit.title} query={query} />
                </span>
                <Extra hit={hit} query={query} />
              </span>
              <span className={styles.date}>{dayLabel(hit.date)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shows where the match is when it is not in the title. */
function Extra({ hit, query }: { hit: SearchHit; query: string }) {
  const q = query.toLowerCase();
  if (hit.title.toLowerCase().includes(q)) return null;
  const item = hit.items.find((it) => it.text.toLowerCase().includes(q));
  if (item) {
    return (
      <span className={styles.extra}>
        ☑ <Highlight text={item.text} query={query} />
      </span>
    );
  }
  if (hit.note) {
    const at = hit.note.toLowerCase().indexOf(q);
    if (at >= 0) {
      const start = Math.max(0, at - 30);
      const piece = (start > 0 ? "…" : "") + hit.note.slice(start, at + q.length + 40).replace(/\s+/g, " ");
      return (
        <span className={styles.extra}>
          ✎ <Highlight text={piece} query={query} />
        </span>
      );
    }
  }
  return null;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className={styles.mark2}>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

function dayLabel(date: string): string {
  const named = relativeDayName(date);
  if (named) return named;
  const d = fromDateKey(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? "d MMM" : "d MMM yyyy", { locale: ru });
}

export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
      <path d="M20 20l-3.6-3.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
