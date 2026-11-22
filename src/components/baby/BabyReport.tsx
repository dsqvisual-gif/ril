"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  listEvents,
  listFoods,
  listGrowth,
  type BabyEventDTO,
  type ChildDTO,
  type FoodDTO,
  type GrowthDTO,
} from "@/lib/actions/baby";
import { listHealth, type HealthDTO } from "@/lib/actions/baby-care";
import { unwrap } from "@/lib/action-result";
import { FOOD_REACTIONS, FOOD_STATUS, childAge, formatDuration } from "@/lib/baby";
import { fromDateKey, shiftDateKey, todayKey } from "@/lib/dates";
import { buildStats, type DayStat } from "./BabyStats";
import styles from "./BabyReport.module.css";

const DAY = 86_400_000;

function hours(ms: number): string {
  return ms ? (ms / 3_600_000).toFixed(1).replace(".", ",") : "0";
}

export function BabyReport({ kids }: { kids: ChildDTO[] }) {
  const [childId, setChildId] = useState(kids[0]?.id ?? null);
  const [days, setDays] = useState(30);
  const child = kids.find((c) => c.id === childId) ?? null;

  if (!child) {
    return (
      <p className={styles.empty}>
        Сначала добавьте малыша на вкладке <Link href="/app/baby">«Малыш»</Link>.
      </p>
    );
  }
  return (
    <section className={styles.root}>
      <div className={styles.controls}>
        {kids.length > 1
          ? kids.map((c) => (
              <button key={c.id} type="button" className={c.id === childId ? styles.on : styles.off} onClick={() => setChildId(c.id)}>
                {c.name}
              </button>
            ))
          : null}
        {[7, 14, 30].map((n) => (
          <button key={n} type="button" className={days === n ? styles.on : styles.off} onClick={() => setDays(n)}>
            {n} дней
          </button>
        ))}
        <button type="button" className={styles.print} onClick={() => window.print()}>
          🖨 Печать или PDF
        </button>
      </div>
      <Report key={`${child.id}-${days}`} child={child} days={days} />
    </section>
  );
}

function Report({ child, days }: { child: ChildDTO; days: number }) {
  const [now] = useState(() => Date.now());
  const [events, setEvents] = useState<BabyEventDTO[] | null>(null);
  const [growth, setGrowth] = useState<GrowthDTO[]>([]);
  const [foods, setFoods] = useState<FoodDTO[]>([]);
  const [health, setHealth] = useState<HealthDTO[]>([]);
  const today = todayKey();
  const from = shiftDateKey(today, -(days - 1));

  useEffect(() => {
    const start = new Date(now - (days - 1) * DAY);
    start.setHours(0, 0, 0, 0);
    void listEvents(child.id, start.toISOString(), new Date(now + 60_000).toISOString()).then((r) => setEvents(unwrap(r)));
    void listGrowth(child.id).then((r) => r.ok && setGrowth(r.data));
    void listFoods(child.id).then((r) => r.ok && setFoods(r.data));
    void listHealth(child.id).then((r) => r.ok && setHealth(r.data));
  }, [child.id, days, now]);

  const stats: DayStat[] = useMemo(() => (events ? buildStats(events, days, now) : []), [events, days, now]);
  const filled = stats.filter((d) => d.daySleep + d.nightSleep + d.feeds + d.pee + d.poo > 0);
  const avg = (pick: (d: DayStat) => number) => (filled.length ? filled.reduce((s, d) => s + pick(d), 0) / filled.length : 0);

  function downloadCsv() {
    const rows = [
      ["Дата", "Сон всего, ч", "Ночной сон, ч", "Дневной сон, ч", "Кормлений", "Мокрых", "Грязных"],
      ...stats.map((d) => [
        format(d.start, "yyyy-MM-dd"),
        hours(d.daySleep + d.nightSleep),
        hours(d.nightSleep),
        hours(d.daySleep),
        String(d.feeds),
        String(d.pee),
        String(d.poo),
      ]),
    ];
    const csv = "﻿" + rows.map((r) => r.join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${child.name}-${from}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const lastGrowth = [...growth].reverse();
  const recentHealth = health.filter((h) => h.date >= shiftDateKey(today, -180));

  return (
    <article className={styles.sheet}>
      <header className={styles.head}>
        <div>
          <h1>{child.name}</h1>
          <p>
            Дата рождения: {format(fromDateKey(child.birthDate), "d MMMM yyyy", { locale: ru })} · возраст{" "}
            {childAge(child.birthDate, today)}
          </p>
        </div>
        <p className={styles.period}>
          Период: {format(fromDateKey(from), "d MMM", { locale: ru })} — {format(fromDateKey(today), "d MMM yyyy", { locale: ru })}
          <br />
          Составлено в Uspeyka по записям родителей
        </p>
      </header>

      <h2>Кратко</h2>
      {events === null ? <p>Считаю…</p> : null}
      <table className={styles.table}>
        <tbody>
          <tr>
            <td>Сон в сутки, в среднем</td>
            <td>{formatDuration(avg((d) => d.daySleep + d.nightSleep))}</td>
          </tr>
          <tr>
            <td>— из них ночью (20:00–08:00)</td>
            <td>{formatDuration(avg((d) => d.nightSleep))}</td>
          </tr>
          <tr>
            <td>Кормлений в день</td>
            <td>{avg((d) => d.feeds).toFixed(1).replace(".", ",")}</td>
          </tr>
          <tr>
            <td>Подгузников в день: мокрых / грязных</td>
            <td>
              {avg((d) => d.pee).toFixed(1).replace(".", ",")} / {avg((d) => d.poo).toFixed(1).replace(".", ",")}
            </td>
          </tr>
          <tr>
            <td>Дней с записями</td>
            <td>
              {filled.length} из {days}
            </td>
          </tr>
        </tbody>
      </table>

      {lastGrowth.length > 0 ? (
        <>
          <h2>Рост и вес</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Вес</th>
                <th>Рост</th>
                <th>Голова</th>
              </tr>
            </thead>
            <tbody>
              {lastGrowth.slice(0, 8).map((g) => (
                <tr key={g.id}>
                  <td>{format(fromDateKey(g.date), "d MMM yyyy", { locale: ru })}</td>
                  <td>{g.weightG !== null ? `${(g.weightG / 1000).toFixed(2).replace(".", ",")} кг` : "—"}</td>
                  <td>{g.heightCm !== null ? `${String(g.heightCm).replace(".", ",")} см` : "—"}</td>
                  <td>{g.headCm !== null ? `${String(g.headCm).replace(".", ",")} см` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h2>По дням</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>День</th>
            <th>Сон, ч</th>
            <th>Ночью, ч</th>
            <th>Кормлений</th>
            <th>Мокр.</th>
            <th>Гряз.</th>
          </tr>
        </thead>
        <tbody>
          {[...filled].reverse().map((d) => (
            <tr key={d.start}>
              <td>{format(d.start, "d MMM, EEEEEE", { locale: ru })}</td>
              <td>{hours(d.daySleep + d.nightSleep)}</td>
              <td>{hours(d.nightSleep)}</td>
              <td>{d.feeds}</td>
              <td>{d.pee}</td>
              <td>{d.poo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {filled.length < stats.length ? (
        <p className={styles.note}>Дней без записей за период: {stats.length - filled.length} — они в таблицу не вошли.</p>
      ) : null}

      {foods.length > 0 ? (
        <>
          <h2>Прикорм</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Продукт</th>
                <th>С какого дня</th>
                <th>Статус</th>
                <th>Реакции</th>
              </tr>
            </thead>
            <tbody>
              {foods.map((f) => {
                const reactions = f.tries.filter((t) => t.reaction !== "none");
                return (
                  <tr key={f.id}>
                    <td>{f.product}</td>
                    <td>
                      {format(fromDateKey(f.startDate), "d MMM", { locale: ru })} (
                      {differenceInCalendarDays(fromDateKey(today), fromDateKey(f.startDate)) + 1} дн.)
                    </td>
                    <td>{FOOD_STATUS[f.status].label}</td>
                    <td>
                      {reactions.length
                        ? reactions
                            .map((t) => `${format(fromDateKey(t.date), "d MMM", { locale: ru })}: ${FOOD_REACTIONS[t.reaction]}${t.note ? ` (${t.note})` : ""}`)
                            .join("; ")
                        : "нет"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : null}

      {recentHealth.length > 0 ? (
        <>
          <h2>Прививки и визиты</h2>
          <table className={styles.table}>
            <tbody>
              {recentHealth.map((h) => (
                <tr key={h.id}>
                  <td>{format(fromDateKey(h.date), "d MMM yyyy", { locale: ru })}</td>
                  <td>
                    {h.kind === "vaccine" ? "Прививка" : "Визит"}: {h.title}
                    {h.note ? ` — ${h.note}` : ""}
                  </td>
                  <td>{h.done ? "сделано" : h.date >= today ? "запланировано" : "не отмечено"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <p className={styles.foot}>
        Данные записаны родителями в приложении и могут быть неполными. <button type="button" onClick={downloadCsv}>Скачать по дням (CSV)</button>
      </p>
    </article>
  );
}
