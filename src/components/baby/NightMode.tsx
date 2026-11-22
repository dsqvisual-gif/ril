"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import type { BabyEventDTO } from "@/lib/actions/baby";
import { formatClock, formatDuration, type DiaperData } from "@/lib/baby";
import styles from "./NightMode.module.css";

type Props = {
  childName: string;
  girl: boolean;
  now: number;
  runningSleep: BabyEventDTO | null;
  runningFeed: BabyEventDTO | null;
  lastSleepEnd: number | null;
  lastFeedStart: number | null;
  busy: string | null;
  onSleep: () => void;
  onFeed: () => void;
  onDiaper: (data: DiaperData) => void;
  onClose: () => void;
};

/** Dim full-screen controls for 3 a.m.: three huge buttons and the timers. */
export function NightMode(props: Props) {
  const { now, runningSleep, runningFeed, busy } = props;

  // Keep the screen on while it is open, where the browser allows it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    void nav.wakeLock
      ?.request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
    };
  }, []);

  return (
    <div className={styles.night} role="dialog" aria-label="Ночной режим">
      <div className={styles.top}>
        <span className={styles.clock}>{format(now, "HH:mm")}</span>
        <span className={styles.name}>{props.childName}</span>
        <button type="button" className={styles.close} onClick={props.onClose}>
          Выйти
        </button>
      </div>

      <button
        type="button"
        className={`${styles.big} ${runningSleep ? styles.active : ""}`}
        disabled={busy === "sleep"}
        onClick={props.onSleep}
      >
        <span className={styles.icon}>{runningSleep ? "☀️" : "🌙"}</span>
        <span className={styles.label}>
          {runningSleep ? (props.girl ? "Проснулась" : "Проснулся") : props.girl ? "Уснула" : "Уснул"}
        </span>
        <span className={styles.meta}>
          {runningSleep
            ? `спит ${formatClock(now - new Date(runningSleep.startedAt).getTime())}`
            : props.lastSleepEnd
              ? `бодрствует ${formatDuration(now - props.lastSleepEnd)}`
              : ""}
        </span>
      </button>

      <button
        type="button"
        className={`${styles.big} ${runningFeed ? styles.active : ""}`}
        disabled={busy === "feed"}
        onClick={props.onFeed}
      >
        <span className={styles.icon}>🍼</span>
        <span className={styles.label}>{runningFeed ? "Закончить кормление" : "Кормление"}</span>
        <span className={styles.meta}>
          {runningFeed
            ? formatClock(now - new Date(runningFeed.startedAt).getTime())
            : props.lastFeedStart
              ? `${formatDuration(now - props.lastFeedStart)} назад`
              : ""}
        </span>
      </button>

      <div className={styles.row}>
        <button type="button" className={styles.small} disabled={busy === "diaper"} onClick={() => props.onDiaper({ pee: true, poo: false })}>
          💧 Мокрый
        </button>
        <button type="button" className={styles.small} disabled={busy === "diaper"} onClick={() => props.onDiaper({ pee: false, poo: true })}>
          💩 Грязный
        </button>
      </div>
    </div>
  );
}
