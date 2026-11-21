"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./InstallPrompt.module.css";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const HIDE_KEY = "uspeyka:install-hidden-until";
const HIDE_DAYS = 14;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

function hiddenNow(): boolean {
  try {
    return Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

/** Offers to install the app: a button where the browser allows it, instructions on iPhone. */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || hiddenNow()) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Safari on iPhone has no install button: show how to add it by hand.
    const timer = setTimeout(() => {
      if (isIos()) {
        setIos(true);
        setHidden(false);
      }
    }, 1500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, []);

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86_400_000));
    } catch {
      // Private mode: it just shows again next time.
    }
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    if (choice?.outcome === "accepted") setHidden(true);
    else hide();
  }

  if (hidden || (!installEvent && !ios)) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Установить приложение">
      <Image src="/icon-192.png" alt="" width={44} height={44} className={styles.icon} />
      <div className={styles.text}>
        <p className={styles.title}>Uspeyka на главном экране</p>
        {ios ? (
          <p className={styles.sub}>
            Нажмите <ShareIcon /> «Поделиться», затем «На экран „Домой“».
          </p>
        ) : (
          <p className={styles.sub}>Открывается как приложение, без адресной строки.</p>
        )}
      </div>
      {installEvent ? (
        <button type="button" className={`btn btn-primary ${styles.install}`} onClick={() => void install()}>
          Установить
        </button>
      ) : null}
      <button type="button" className={styles.close} aria-label="Скрыть" onClick={hide}>
        ×
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.share} aria-label="значок «Поделиться»">
      <path d="M12 3v12M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}
