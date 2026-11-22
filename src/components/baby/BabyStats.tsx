"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  addGrowth,
  deleteGrowth,
  listEvents,
  listGrowth,
  type BabyEventDTO,
  type ChildDTO,
  type GrowthDTO,
} from "@/lib/actions/baby";
import { errorText, unwrap } from "@/lib/action-result";
import { formatDuration, type DiaperData } from "@/lib/baby";
import { fromDateKey, todayKey } from "@/lib/dates";
import { AchievementToast } from "../AchievementToast";
import styles from "./Baby.module.css";

const DAY = 86_400_000;
/** Sleep starting 20:00–07:59 counts as night sleep. */
const NIGHT_FROM = 20;
const NIGHT_TO = 8;

type DayStat = {
  start: number;
  daySleep: number;
  nightSleep: number;
  feeds: number;
  pee: number;
  poo: number;
};

function startOfLocalDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function buildStats(events: BabyEventDTO[], days: number, now: number): DayStat[] {
  const first = startOfLocalDay(now) - (days - 1) * DAY;
  const stats: DayStat[] = Array.from({ length: days }, (_, i) => ({
    start: first + i * DAY,
    daySleep: 0,
    nightSleep: 0,
    feeds: 0,
    pee: 0,
    poo: 0,
  }));
  const indexOf = (t: number) => Math.floor((startOfLocalDay(t) - first) / DAY);

  for (const e of events) {
    const start = new Date(e.startedAt).getTime();
    if (e.kind === "sleep") {
      const end = e.endedAt ? new Date(e.endedAt).getTime() : now;
      const hour = new Date(start).getHours();
      const night = hour >= NIGHT_FROM || hour < NIGHT_TO;
      // Split the sleep across the days it covers.
      for (let t = start; t < end; ) {
        const dayEnd = startOfLocalDay(t) + DAY;
        const piece = Math.min(end, dayEnd) - t;
        const i = indexOf(t);
        if (i >= 0 && i < days) {
          if (night) stats[i].nightSleep += piece;
          else stats[i].daySleep += piece;
        }
        t = dayEnd;
      }
      continue;
    }
    const i = indexOf(start);
    if (i < 0 || i >= days) continue;
    if (e.kind === "feed") {
      stats[i].feeds += 1;
    } else {
      const d = e.data as DiaperData | null;
      if (d?.pee) stats[i].pee += 1;
      if (d?.poo) stats[i].poo += 1;
    }
  }
  return stats;
}

export function BabyStats({ kids }: { kids: ChildDTO[] }) {
  const [childId, setChildId] = useState(kids[0]?.id ?? null);
  const child = kids.find((c) => c.id === childId) ?? null;

  if (!child) {
    return (
      <section className={styles.root}>
        <p className={styles.emptyBig}>Сначала добавьте малыша на вкладке «Малыш».</p>
      </section>
    );
  }

  return (
    <section className={styles.root}>
      {kids.length > 1 ? (
        <div className={styles.children}>
          {kids.map((c) => (
            <button key={c.id} type="button" className={c.id === childId ? styles.childOn : styles.child} onClick={() => setChildId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
      <StatsBoard key={child.id} child={child} />
    </section>
  );
}

function StatsBoard({ child }: { child: ChildDTO }) {
  const [days, setDays] = useState(7);
  const [events, setEvents] = useState<BabyEventDTO[] | null>(null);
  const [growth, setGrowth] = useState<GrowthDTO[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const from = new Date(startOfLocalDay(now) - (days - 1) * DAY).toISOString();
    const to = new Date(now + 60_000).toISOString();
    void listEvents(child.id, from, to)
      .then((r) => setEvents(unwrap(r)))
      .catch((err) => setToast(errorText(err, "Не удалось загрузить статистику")));
  }, [child.id, days, now]);

  useEffect(() => {
    void listGrowth(child.id)
      .then((r) => setGrowth(unwrap(r)))
      .catch(() => {});
  }, [child.id]);

  const stats = useMemo(() => (events ? buildStats(events, days, now) : []), [events, days, now]);
  // Averages over days that have any record, so a fresh start does not drag them down.
  const filled = stats.filter((d) => d.daySleep + d.nightSleep + d.feeds + d.pee + d.poo > 0);
  const avg = (pick: (d: DayStat) => number) =>
    filled.length ? filled.reduce((s, d) => s + pick(d), 0) / filled.length : 0;
  const maxSleep = Math.max(1, ...stats.map((d) => d.daySleep + d.nightSleep));
  const maxFeeds = Math.max(1, ...stats.map((d) => d.feeds));
  const maxDiapers = Math.max(1, ...stats.map((d) => d.pee + d.poo));

  return (
    <>
      <div className={styles.headline}>
        <h1 className={styles.childName}>Статистика</h1>
        <div className={styles.quickMl}>
          {[7, 14].map((n) => (
            <button key={n} type="button" className={days === n ? styles.chipOn : styles.chip} onClick={() => setDays(n)}>
              {n} дней
            </button>
          ))}
        </div>
      </div>

      <div className={styles.avgRow}>
        <div>
          <b>{formatDuration(avg((d) => d.daySleep + d.nightSleep))}</b>
          <span>сна в сутки</span>
        </div>
        <div>
          <b>{formatDuration(avg((d) => d.nightSleep))}</b>
          <span>из них ночью</span>
        </div>
        <div>
          <b>{avg((d) => d.feeds).toFixed(1).replace(".0", "")}</b>
          <span>кормлений в день</span>
        </div>
        <div>
          <b>{avg((d) => d.pee + d.poo).toFixed(1).replace(".0", "")}</b>
          <span>подгузников в день</span>
        </div>
      </div>

      {events === null ? <p className={styles.hint}>Считаю…</p> : null}

      <Chart
        title="😴 Сон"
        legend={[
          ["Ночью", styles.barNight],
          ["Днём", styles.barDay],
        ]}
        stats={stats}
        render={(d) => (
          <>
            <span className={styles.barNight} style={{ height: `${(d.nightSleep / maxSleep) * 100}%` }} />
            <span className={styles.barDay} style={{ height: `${(d.daySleep / maxSleep) * 100}%` }} />
          </>
        )}
        label={(d) => (d.daySleep + d.nightSleep ? `${Math.round((d.daySleep + d.nightSleep) / 3_600_000)}ч` : "")}
      />

      <Chart
        title="🍼 Кормления"
        legend={[]}
        stats={stats}
        render={(d) => <span className={styles.barFeed} style={{ height: `${(d.feeds / maxFeeds) * 100}%` }} />}
        label={(d) => (d.feeds ? String(d.feeds) : "")}
      />

      <Chart
        title="🧷 Подгузники"
        legend={[
          ["Мокрые", styles.barPee],
          ["Грязные", styles.barPoo],
        ]}
        stats={stats}
        render={(d) => (
          <>
            <span className={styles.barPee} style={{ height: `${(d.pee / maxDiapers) * 100}%` }} />
            <span className={styles.barPoo} style={{ height: `${(d.poo / maxDiapers) * 100}%` }} />
          </>
        )}
        label={(d) => (d.pee + d.poo ? String(d.pee + d.poo) : "")}
      />

      <Growth
        childId={child.id}
        growth={growth}
        onChange={setGrowth}
        onError={setToast}
      />

      {toast ? <AchievementToast kind="error" title={toast} onClose={() => setToast(null)} /> : null}
    </>
  );
}

function Chart({
  title,
  legend,
  stats,
  render,
  label,
}: {
  title: string;
  legend: [string, string][];
  stats: DayStat[];
  render: (d: DayStat) => React.ReactNode;
  label: (d: DayStat) => string;
}) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHead}>
        <h2 className={styles.groupTitle}>{title}</h2>
        <div className={styles.legend}>
          {legend.map(([name, cls]) => (
            <span key={name}>
              <i className={cls} /> {name}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.chart} style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
        {stats.map((d) => (
          <div key={d.start} className={styles.chartCol}>
            <small>{label(d)}</small>
            <div className={styles.stack}>{render(d)}</div>
            <span>{format(new Date(d.start), stats.length > 7 ? "d" : "EEEEEE", { locale: ru })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Growth({
  childId,
  growth,
  onChange,
  onError,
}: {
  childId: string;
  growth: GrowthDTO[];
  onChange: (g: GrowthDTO[]) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");
  const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const row = unwrap(
        await addGrowth(childId, { date, weightKg: num(weight), heightCm: num(height), headCm: num(head) }),
      );
      onChange([...growth, row].sort((a, b) => a.date.localeCompare(b.date)));
      setWeight("");
      setHeight("");
      setHead("");
      setOpen(false);
    } catch (err) {
      onError(errorText(err, "Не удалось сохранить"));
    }
  }

  const weights = growth.filter((g) => g.weightG !== null);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHead}>
        <h2 className={styles.groupTitle}>📏 Рост и вес</h2>
        <button type="button" className={styles.linkBtn} onClick={() => setOpen((v) => !v)}>
          {open ? "Закрыть" : "+ Записать замер"}
        </button>
      </div>

      {open ? (
        <form className={styles.growthForm} onSubmit={submit}>
          <label>
            Дата
            <input className={styles.input} type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Вес, кг
            <input className={styles.input} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="6,4" />
          </label>
          <label>
            Рост, см
            <input className={styles.input} inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="62" />
          </label>
          <label>
            Голова, см
            <input className={styles.input} inputMode="decimal" value={head} onChange={(e) => setHead(e.target.value)} placeholder="41" />
          </label>
          <button type="submit" className={styles.bigBtn}>
            Сохранить
          </button>
        </form>
      ) : null}

      {weights.length >= 2 ? <WeightLine points={weights} /> : null}

      {growth.length > 0 ? (
        <table className={styles.growthTable}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Вес</th>
              <th>Рост</th>
              <th>Голова</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...growth].reverse().map((g) => (
              <tr key={g.id}>
                <td>{format(fromDateKey(g.date), "d MMM yyyy", { locale: ru })}</td>
                <td>{g.weightG !== null ? `${(g.weightG / 1000).toFixed(2).replace(".", ",")} кг` : "—"}</td>
                <td>{g.heightCm !== null ? `${String(g.heightCm).replace(".", ",")} см` : "—"}</td>
                <td>{g.headCm !== null ? `${String(g.headCm).replace(".", ",")} см` : "—"}</td>
                <td>
                  <button
                    type="button"
                    aria-label="Удалить замер"
                    className={styles.iconBtn}
                    onClick={async () => {
                      const r = await deleteGrowth(g.id);
                      if (r.ok) onChange(growth.filter((x) => x.id !== g.id));
                      else onError(r.error);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.hint}>Записывайте замеры после визита к педиатру — здесь появится таблица и график веса.</p>
      )}
    </div>
  );
}

function WeightLine({ points }: { points: GrowthDTO[] }) {
  const W = 600;
  const H = 160;
  const pad = 24;
  const xs = points.map((p) => fromDateKey(p.date).getTime());
  const ys = points.map((p) => p.weightG! / 1000);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => pad + ((x - x0) / Math.max(1, x1 - x0)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - y0) / Math.max(0.1, y1 - y0)) * (H - 2 * pad);
  const path = xs.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.weightChart} role="img" aria-label="График веса">
      <path d={path} className={styles.weightPath} />
      {xs.map((x, i) => (
        <g key={points[i].id}>
          <circle cx={sx(x)} cy={sy(ys[i])} r={4.5} className={styles.weightDot} />
          <text x={sx(x)} y={sy(ys[i]) - 9} textAnchor="middle" className={styles.weightLabel}>
            {ys[i].toFixed(1).replace(".", ",")}
          </text>
        </g>
      ))}
    </svg>
  );
}
