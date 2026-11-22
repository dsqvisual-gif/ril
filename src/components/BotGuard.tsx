"use client";

import { useEffect, useRef, useState } from "react";
import { HONEYPOT_FIELD, STARTED_FIELD } from "@/lib/bot-check-fields";
import styles from "./BotGuard.module.css";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Bot protection inside a form that sends email: a hidden trap field, the time
 * the form was shown and, when configured, a Cloudflare Turnstile check.
 * Change `resetKey` after a failed submit: a Turnstile token works only once.
 */
export function BotGuard({ resetKey }: { resetKey?: unknown }) {
  const [started] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let cancelled = false;
    const el = box.current;
    loadTurnstile()
      .then((t) => {
        if (cancelled || widget.current) return;
        widget.current = t.render(el, {
          sitekey: SITE_KEY,
          language: "ru",
          theme: "auto",
          size: "flexible",
          appearance: "interaction-only",
          "error-callback": () => setFailed(true),
          callback: () => setFailed(false),
        });
      })
      .catch(() => {
        // Blocked by an ad blocker or no connection to Cloudflare.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey && widget.current) window.turnstile?.reset(widget.current);
  }, [resetKey]);

  return (
    <>
      <div className={styles.trap} aria-hidden>
        <label>
          Не заполняйте это поле
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input type="hidden" name={STARTED_FIELD} value={started} />
      {SITE_KEY ? <div ref={box} className={styles.widget} /> : null}
      {failed ? (
        <p className={styles.failed}>
          Не загрузилась проверка «я не робот». Обновите страницу или отключите блокировщик рекламы
          для этого сайта.
        </p>
      ) : null}
    </>
  );
}
