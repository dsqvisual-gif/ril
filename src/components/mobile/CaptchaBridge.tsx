"use client";

import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string };
type NativeBridge = { postMessage: (data: string) => void };

/** Sends the result to the app: a WebView on phones, the parent page in a browser. */
function send(message: { type: "token" | "error" | "ready"; token?: string }) {
  const bridge = (window as unknown as { ReactNativeWebView?: NativeBridge }).ReactNativeWebView;
  const data = JSON.stringify({ source: "uspeyka-captcha", ...message });
  if (bridge) bridge.postMessage(data);
  else window.parent?.postMessage(data, "*");
}

export function CaptchaBridge() {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // No check configured: the app may go on without a token.
    if (!SITE_KEY) {
      send({ type: "token", token: "" });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      const t = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (!t || !box.current) return;
      t.render(box.current, {
        sitekey: SITE_KEY,
        language: "ru",
        theme: "auto",
        callback: (token: string) => send({ type: "token", token }),
        "error-callback": () => {
          setFailed(true);
          send({ type: "error" });
        },
      });
      send({ type: "ready" });
    };
    script.onerror = () => {
      setFailed(true);
      send({ type: "error" });
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <div ref={box} />
      {failed ? <p style={{ color: "#d33", fontSize: 14 }}>Проверка не загрузилась. Попробуйте ещё раз.</p> : null}
    </div>
  );
}
