"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { applyVoicePlan, interpretVoice, type VoicePlan } from "@/lib/actions/voice";
import type { TaskDTO } from "@/lib/actions/tasks";
import { errorText, unwrap } from "@/lib/action-result";
import { fromDateKey, todayKey } from "@/lib/dates";
import styles from "./VoiceMic.module.css";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

type Props = {
  focusDate: string;
  onApplied: (result: { created: TaskDTO[]; removedIds: string[] }) => void;
};

function speechCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const host = window as SpeechWindow;
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function transcriptOf(event: Event): string {
  const results = (event as Event & { results?: ArrayLike<{ 0?: { transcript?: string } }> }).results;
  if (!results) return "";
  return Array.from(results)
    .map((item) => item[0]?.transcript ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "сегодня";
  return format(fromDateKey(date), "d MMMM", { locale: ru });
}

export function VoiceMic({ focusDate, onApplied }: Props) {
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef("");
  const ignoreEnd = useRef(false);
  const sent = useRef(false);
  const [phase, setPhase] = useState<"idle" | "listening" | "thinking" | "review" | "type">("idle");
  const [live, setLive] = useState("");
  const [draft, setDraft] = useState("");
  const [plan, setPlan] = useState<VoicePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [doneNote, setDoneNote] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      ignoreEnd.current = true;
      recognition.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!doneNote) return;
    const timer = window.setTimeout(() => setDoneNote(null), 3200);
    return () => window.clearTimeout(timer);
  }, [doneNote]);

  async function understand(text: string) {
    setPhase("thinking");
    setError(null);
    setPlan(null);
    try {
      const next = unwrap(await interpretVoice(text, todayKey(), focusDate));
      setPlan(next);
      setPhase("review");
    } catch (err) {
      setPhase("idle");
      setError(errorText(err, "Не удалось разобрать фразу"));
    }
  }

  function start() {
    const Ctor = speechCtor();
    if (!Ctor) {
      setPhase("type");
      setError(null);
      return;
    }
    ignoreEnd.current = false;
    sent.current = false;
    heard.current = "";
    setLive("");
    setError(null);
    setDoneNote(null);
    setPlan(null);

    const session = new Ctor();
    recognition.current = session;
    session.lang = "ru-RU";
    session.continuous = true;
    session.interimResults = true;
    session.onresult = (event) => {
      const text = transcriptOf(event);
      heard.current = text;
      setLive(text);
    };
    session.onerror = (event) => {
      const code = (event as Event & { error?: string }).error;
      if (code === "aborted" || code === "no-speech") return;
      ignoreEnd.current = true;
      if (code === "not-allowed") setError("Нужен доступ к микрофону");
      else setError("Не удалось включить микрофон");
      setPhase("idle");
    };
    session.onend = () => {
      if (ignoreEnd.current || sent.current) return;
      sent.current = true;
      const text = heard.current.trim();
      if (!text) {
        setPhase("idle");
        setError("Не услышал речь");
        return;
      }
      void understand(text);
    };

    try {
      session.start();
      setPhase("listening");
    } catch {
      setPhase("idle");
      setError("Не удалось включить микрофон");
    }
  }

  function stop() {
    try {
      recognition.current?.stop();
    } catch {
      setPhase("idle");
    }
  }

  function closeReview() {
    if (applying) return;
    setPhase("idle");
    setPlan(null);
    setDraft("");
  }

  async function apply() {
    if (!plan || applying) return;
    if (plan.add.length === 0 && plan.remove.length === 0) {
      closeReview();
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const result = unwrap(await applyVoicePlan(plan));
      onApplied(result);
      const parts: string[] = [];
      if (result.created.length > 0) parts.push(`Добавлено: ${result.created.length}`);
      if (result.removedIds.length > 0) parts.push(`Удалено: ${result.removedIds.length}`);
      setDoneNote(parts.join(" · ") || "Готово");
      setPhase("idle");
      setPlan(null);
      setDraft("");
    } catch (err) {
      setError(errorText(err, "Не удалось сохранить"));
    } finally {
      setApplying(false);
    }
  }

  const today = todayKey();
  const canApply = Boolean(plan && (plan.add.length > 0 || plan.remove.length > 0));

  return (
    <>
      <div className={styles.dock}>
        {phase === "listening" ? <p className={styles.bubble}>{live || "Слушаю…"}</p> : null}
        {phase === "thinking" ? <p className={styles.bubble}>Разбираю фразу…</p> : null}
        {error ? <p className={styles.errorBubble}>{error}</p> : null}
        {doneNote ? <p className={styles.bubble}>{doneNote}</p> : null}
        <button
          type="button"
          className={`${styles.fab} ${phase === "listening" ? styles.live : ""}`}
          aria-label={phase === "listening" ? "Остановить запись" : "Надиктовать дело"}
          aria-pressed={phase === "listening"}
          disabled={phase === "thinking" || applying}
          onClick={() => {
            if (phase === "listening") stop();
            else if (phase === "idle") start();
          }}
        >
          <MicIcon />
        </button>
      </div>

      {phase === "type" ? (
        <div className={styles.backdrop} role="presentation" onClick={closeReview}>
          <form
            className={styles.card}
            role="dialog"
            aria-label="Надиктовать текстом"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim().length >= 2) void understand(draft);
            }}
          >
            <p className={styles.kicker}>Микрофон в этом браузере недоступен</p>
            <label className={styles.fieldLabel} htmlFor="voice-draft">
              Напишите, что сделать
            </label>
            <textarea
              id="voice-draft"
              className={styles.draft}
              value={draft}
              autoFocus
              maxLength={500}
              placeholder="Добавь купить молоко завтра и удали созвон"
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className={styles.actions}>
              <button type="button" className="btn btn-ghost" onClick={closeReview}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={draft.trim().length < 2}>
                Разобрать
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {phase === "review" && plan ? (
        <div className={styles.backdrop} role="presentation" onClick={closeReview}>
          <div
            className={styles.card}
            role="dialog"
            aria-label="Что сделать с делами"
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.kicker}>Понял так</p>
            {plan.note ? <p className={styles.note}>{plan.note}</p> : null}

            {plan.add.length > 0 ? (
              <div>
                <h2 className={styles.heading}>Добавить</h2>
                <ul className={styles.list}>
                  {plan.add.map((item, index) => (
                    <li key={`${item.date}-${item.title}-${index}`}>
                      <span>{item.title}</span>
                      <small>
                        {dayLabel(item.date, today)}
                        {item.time ? ` · ${item.time}` : ""}
                        {item.urgent ? " · срочно" : item.important ? " · важно" : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan.remove.length > 0 ? (
              <div>
                <h2 className={`${styles.heading} ${styles.danger}`}>Удалить</h2>
                <ul className={styles.list}>
                  {plan.remove.map((item) => (
                    <li key={item.id}>
                      <span>{item.title}</span>
                      <small>{dayLabel(item.date, today)}</small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={styles.actions}>
              <button type="button" className="btn btn-ghost" onClick={closeReview} disabled={applying}>
                Отмена
              </button>
              {canApply ? (
                <button type="button" className="btn btn-primary" onClick={() => void apply()} disabled={applying}>
                  {applying ? "Сохраняю…" : "Применить"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </>
  );
}

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M6 11a6 6 0 0 0 12 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 17v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
