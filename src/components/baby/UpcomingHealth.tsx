"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { listHealth, type HealthDTO } from "@/lib/actions/baby-care";
import { fromDateKey, todayKey } from "@/lib/dates";
import { describeIn } from "@/lib/reminders";
import styles from "./Baby.module.css";

/** The next vaccination or doctor visit, with a link to the health page. */
export function UpcomingHealth({ childId }: { childId: string }) {
  const [next, setNext] = useState<HealthDTO | null | undefined>(undefined);

  useEffect(() => {
    void listHealth(childId).then((r) => {
      if (!r.ok) return setNext(null);
      const today = todayKey();
      setNext(r.data.find((h) => !h.done && h.date >= today) ?? null);
    });
  }, [childId]);

  if (next === undefined) return null;
  return (
    <Link href="/app/baby/health" className={styles.healthCard}>
      <span className={styles.eventIcon}>{next?.kind === "vaccine" ? "💉" : "🩺"}</span>
      <span className={styles.eventBody}>
        {next ? (
          <>
            <b>{next.title}</b>
            <small>
              {format(fromDateKey(next.date), "d MMMM", { locale: ru })} · {describeIn(todayKey(), next.date)}
            </small>
          </>
        ) : (
          <>
            <b>Прививки и визиты к врачу</b>
            <small>Запишите — пришлём напоминание заранее</small>
          </>
        )}
      </span>
      <span className={styles.chevron}>›</span>
    </Link>
  );
}
