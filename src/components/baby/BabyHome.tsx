"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { format, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";
import {
  addEvent,
  deleteEvent,
  listEvents,
  startTimer,
  stopTimer,
  updateEvent,
  type BabyEventDTO,
  type ChildDTO,
  type EventInput,
} from "@/lib/actions/baby";
import { errorText, unwrap } from "@/lib/action-result";
import {
  childAge,
  formatClock,
  formatDuration,
  type BabyEventKind,
  type DiaperData,
  type FeedData,
} from "@/lib/baby";
import { todayKey } from "@/lib/dates";
import { AchievementToast } from "../AchievementToast";
import { ChildPicker } from "./ChildPicker";
import styles from "./Baby.module.css";

const DAY = 86_400_000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "datetime-local" value for a Date in the user's own time. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventEnd(e: BabyEventDTO, now: number): number {
  return e.endedAt ? new Date(e.endedAt).getTime() : now;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function BabyHome({ initialChildren }: { initialChildren: ChildDTO[] }) {
  const [children, setChildren] = useState(initialChildren);
  const [childId, setChildId] = useState(initialChildren[0]?.id ?? null);
  const child = children.find((c) => c.id === childId) ?? null;

  return (
    <section className={styles.root}>
      <ChildPicker
        kids={children}
        childId={childId}
        onChange={setChildId}
        onSaved={(saved, isNew) => {
          setChildren((prev) => (isNew ? [...prev, saved] : prev.map((c) => (c.id === saved.id ? saved : c))));
          setChildId(saved.id);
        }}
        onDeleted={(id) => {
          const rest = children.filter((c) => c.id !== id);
          setChildren(rest);
          setChildId(rest[0]?.id ?? null);
        }}
      />
      {child ? <ChildDay key={child.id} child={child} /> : null}
    </section>
  );
}

function ChildDay({ child }: { child: ChildDTO }) {
  const now = useNow();
  const [events, setEvents] = useState<BabyEventDTO[]>([]);
  const [day, setDay] = useState(() => startOfLocalDay(new Date()).getTime());
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bottleOpen, setBottleOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const merge = useCallback((items: BabyEventDTO[]) => {
    setEvents((prev) => {
      const map = new Map(prev.map((e) => [e.id, e]));
      for (const item of items) map.set(item.id, item);
      return [...map.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    });
  }, []);

  // The shown day plus the last two days, for "how long since".
  useEffect(() => {
    const from = Math.min(day, Date.now() - 2 * DAY);
    const to = Math.max(day + DAY, Date.now() + 60_000);
    void listEvents(child.id, new Date(from).toISOString(), new Date(to).toISOString())
      .then((result) => merge(unwrap(result)))
      .catch((err) => setToast(errorText(err, "Не удалось загрузить записи")));
  }, [child.id, day, merge]);

  async function act(key: string, run: () => Promise<void>, fallback: string) {
    setBusy(key);
    try {
      await run();
    } catch (err) {
      setToast(errorText(err, fallback));
    } finally {
      setBusy(null);
    }
  }

  const runningSleep = events.find((e) => e.kind === "sleep" && !e.endedAt) ?? null;
  const runningFeed = events.find((e) => e.kind === "feed" && !e.endedAt) ?? null;
  const lastSleep = events.find((e) => e.kind === "sleep" && e.endedAt) ?? null;
  const lastFeed = events.find((e) => e.kind === "feed") ?? null;
  const lastBreast = events.find((e) => e.kind === "feed" && (e.data as FeedData | null)?.type === "breast");
  const lastSide = (lastBreast?.data as FeedData | null)?.side ?? null;
  const suggestedSide = lastSide === "left" ? "right" : lastSide === "right" ? "left" : null;
  const lastDiaper = events.find((e) => e.kind === "diaper") ?? null;

  const dayEvents = useMemo(
    () =>
      events.filter((e) => {
        const start = new Date(e.startedAt).getTime();
        const end = eventEnd(e, now);
        return start < day + DAY && end >= day;
      }),
    [events, day, now],
  );

  const totals = useMemo(() => {
    let sleep = 0;
    let feeds = 0;
    let ml = 0;
    let diapers = 0;
    for (const e of dayEvents) {
      if (e.kind === "sleep") {
        const start = Math.max(new Date(e.startedAt).getTime(), day);
        const end = Math.min(eventEnd(e, now), day + DAY);
        sleep += Math.max(0, end - start);
      } else if (e.kind === "feed") {
        if (new Date(e.startedAt).getTime() >= day) {
          feeds += 1;
          ml += (e.data as FeedData | null)?.ml ?? 0;
        }
      } else if (new Date(e.startedAt).getTime() >= day) diapers += 1;
    }
    return { sleep, feeds, ml, diapers };
  }, [dayEvents, day, now]);

  const isToday = isSameDay(new Date(day), new Date(now));
  const verbs = child.sex === "girl" ? { slept: "Уснула", woke: "Проснулась" } : { slept: "Уснул", woke: "Проснулся" };

  return (
    <>
      <div className={styles.headline}>
        <h1 className={styles.childName}>
          {child.sex === "girl" ? "👧" : child.sex === "boy" ? "👦" : "👶"} {child.name}
        </h1>
        <span className={styles.age}>{childAge(child.birthDate, todayKey())}</span>
      </div>

      <div className={styles.now}>
        {/* ---------- sleep ---------- */}
        <article className={`${styles.nowCard} ${runningSleep ? styles.nowActive : ""}`}>
          <p className={styles.nowLabel}>😴 Сон</p>
          {runningSleep ? (
            <>
              <p className={styles.nowBig}>{formatClock(now - new Date(runningSleep.startedAt).getTime())}</p>
              <p className={styles.nowSub}>спит с {format(new Date(runningSleep.startedAt), "HH:mm")}</p>
              <button
                type="button"
                className={styles.bigBtn}
                disabled={busy === "sleep"}
                onClick={() =>
                  void act("sleep", async () => merge([unwrap(await stopTimer(runningSleep.id))]), "Не удалось остановить")
                }
              >
                ☀️ {verbs.woke}
              </button>
            </>
          ) : (
            <>
              <p className={styles.nowBig}>
                {lastSleep ? formatDuration(now - eventEnd(lastSleep, now)) : "—"}
              </p>
              <p className={styles.nowSub}>{lastSleep ? "бодрствует" : "сна ещё не записано"}</p>
              <button
                type="button"
                className={styles.bigBtn}
                disabled={busy === "sleep"}
                onClick={() =>
                  void act("sleep", async () => merge(unwrap(await startTimer(child.id, "sleep"))), "Не удалось начать сон")
                }
              >
                🌙 {verbs.slept}
              </button>
            </>
          )}
        </article>

        {/* ---------- feeding ---------- */}
        <article className={`${styles.nowCard} ${runningFeed ? styles.nowActive : ""}`}>
          <p className={styles.nowLabel}>🍼 Кормление</p>
          {runningFeed ? (
            <>
              <p className={styles.nowBig}>{formatClock(now - new Date(runningFeed.startedAt).getTime())}</p>
              <p className={styles.nowSub}>
                {(runningFeed.data as FeedData | null)?.side === "left"
                  ? "левая грудь"
                  : (runningFeed.data as FeedData | null)?.side === "right"
                    ? "правая грудь"
                    : "грудь"}
              </p>
              <div className={styles.btnRow}>
                <button
                  type="button"
                  className={styles.softBtn}
                  disabled={busy === "feed"}
                  onClick={() => {
                    const side = (runningFeed.data as FeedData | null)?.side === "left" ? "right" : "left";
                    void act(
                      "feed",
                      async () => merge(unwrap(await startTimer(child.id, "feed", { type: "breast", side }))),
                      "Не удалось сменить грудь",
                    );
                  }}
                >
                  ⇄ Сменить грудь
                </button>
                <button
                  type="button"
                  className={styles.bigBtn}
                  disabled={busy === "feed"}
                  onClick={() =>
                    void act("feed", async () => merge([unwrap(await stopTimer(runningFeed.id))]), "Не удалось остановить")
                  }
                >
                  Закончить
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.nowBig}>
                {lastFeed ? formatDuration(now - new Date(lastFeed.startedAt).getTime()) : "—"}
              </p>
              <p className={styles.nowSub}>
                {lastFeed ? "с прошлого кормления" : "кормлений ещё не записано"}
                {lastSide ? ` · последней была ${lastSide === "left" ? "левая" : "правая"}` : ""}
              </p>
              <div className={styles.btnRow}>
                {(["left", "right"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={side === suggestedSide ? styles.bigBtn : styles.softBtn}
                    disabled={busy === "feed"}
                    title={side === suggestedSide ? "Сейчас эта" : undefined}
                    onClick={() =>
                      void act(
                        "feed",
                        async () => merge(unwrap(await startTimer(child.id, "feed", { type: "breast", side }))),
                        "Не удалось начать кормление",
                      )
                    }
                  >
                    {side === "left" ? "Левая" : "Правая"}
                  </button>
                ))}
                <button type="button" className={styles.softBtn} onClick={() => setBottleOpen((v) => !v)}>
                  🍼 Бутылочка
                </button>
              </div>
              {bottleOpen ? (
                <BottleForm
                  busy={busy === "bottle"}
                  onSave={(data) =>
                    act(
                      "bottle",
                      async () => {
                        merge([
                          unwrap(
                            await addEvent(child.id, {
                              kind: "feed",
                              startedAt: new Date().toISOString(),
                              data,
                            }),
                          ),
                        ]);
                        setBottleOpen(false);
                      },
                      "Не удалось записать",
                    )
                  }
                />
              ) : null}
            </>
          )}
        </article>

        {/* ---------- diaper ---------- */}
        <article className={styles.nowCard}>
          <p className={styles.nowLabel}>🧷 Подгузник</p>
          <p className={styles.nowBig}>
            {lastDiaper ? formatDuration(now - new Date(lastDiaper.startedAt).getTime()) : "—"}
          </p>
          <p className={styles.nowSub}>{lastDiaper ? "с прошлой смены" : "смен ещё не записано"}</p>
          <div className={styles.btnRow}>
            {(
              [
                ["💧 Мокрый", { pee: true, poo: false }],
                ["💩 Грязный", { pee: false, poo: true }],
                ["Оба", { pee: true, poo: true }],
              ] as [string, DiaperData][]
            ).map(([label, data]) => (
              <button
                key={label}
                type="button"
                className={styles.softBtn}
                disabled={busy === "diaper"}
                onClick={() =>
                  void act(
                    "diaper",
                    async () =>
                      merge([
                        unwrap(await addEvent(child.id, { kind: "diaper", startedAt: new Date().toISOString(), data })),
                      ]),
                    "Не удалось записать",
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        </article>
      </div>

      {/* ---------- the day ---------- */}
      <div className={styles.dayHead}>
        <button type="button" className={styles.navBtn} onClick={() => setDay((d) => d - DAY)} aria-label="Предыдущий день">
          ‹
        </button>
        <h2 className={styles.dayTitle}>
          {isToday ? "Сегодня" : format(new Date(day), "d MMMM, EEEE", { locale: ru })}
        </h2>
        <button
          type="button"
          className={styles.navBtn}
          disabled={isToday}
          onClick={() => setDay((d) => d + DAY)}
          aria-label="Следующий день"
        >
          ›
        </button>
      </div>

      <div className={styles.totals}>
        <span>😴 {totals.sleep ? formatDuration(totals.sleep) : "0 мин"} сна</span>
        <span>
          🍼 {totals.feeds} {totals.feeds === 1 ? "кормление" : totals.feeds < 5 && totals.feeds > 1 ? "кормления" : "кормлений"}
          {totals.ml ? ` · ${totals.ml} мл` : ""}
        </span>
        <span>🧷 {totals.diapers} подгузн.</span>
      </div>

      <ul className={styles.timeline}>
        {dayEvents.length === 0 ? <li className={styles.empty}>Записей за этот день нет</li> : null}
        {dayEvents.map((e) =>
          editing === e.id ? (
            <li key={e.id}>
              <EventForm
                kind={e.kind}
                wokeLabel={verbs.woke}
                initial={e}
                onSave={(input) =>
                  act(
                    e.id,
                    async () => {
                      merge([unwrap(await updateEvent(e.id, input))]);
                      setEditing(null);
                    },
                    "Не удалось сохранить",
                  )
                }
                onDelete={() =>
                  act(
                    e.id,
                    async () => {
                      unwrap(await deleteEvent(e.id));
                      setEvents((prev) => prev.filter((x) => x.id !== e.id));
                      setEditing(null);
                    },
                    "Не удалось удалить",
                  )
                }
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={e.id}>
              <button type="button" className={styles.event} onClick={() => setEditing(e.id)}>
                <span className={styles.eventIcon}>{icon(e)}</span>
                <span className={styles.eventBody}>
                  <b>{title(e)}</b>
                  <small>{details(e, now)}</small>
                </span>
                <span className={styles.eventTime}>{format(new Date(e.startedAt), "HH:mm")}</span>
              </button>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <EventForm
          wokeLabel={verbs.woke}
          onSave={(input) =>
            act(
              "add",
              async () => {
                merge([unwrap(await addEvent(child.id, input))]);
                setAdding(false);
              },
              "Не удалось записать",
            )
          }
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className={styles.addLater} onClick={() => setAdding(true)}>
          + Добавить запись задним числом
        </button>
      )}

      {toast ? <AchievementToast kind="error" title={toast} onClose={() => setToast(null)} /> : null}
    </>
  );
}

function icon(e: BabyEventDTO): string {
  if (e.kind === "sleep") return "😴";
  if (e.kind === "diaper") {
    const d = e.data as DiaperData | null;
    return d?.poo ? "💩" : "💧";
  }
  return (e.data as FeedData | null)?.type === "bottle" ? "🍼" : "🤱";
}

function title(e: BabyEventDTO): string {
  if (e.kind === "sleep") return e.endedAt ? "Сон" : "Спит сейчас";
  if (e.kind === "diaper") {
    const d = e.data as DiaperData | null;
    return d?.pee && d?.poo ? "Подгузник: мокрый и грязный" : d?.poo ? "Подгузник: грязный" : "Подгузник: мокрый";
  }
  const f = e.data as FeedData | null;
  if (f?.type === "bottle") return `Бутылочка ${f.ml ?? ""} мл`;
  return f?.side === "left" ? "Грудь: левая" : f?.side === "right" ? "Грудь: правая" : "Грудь";
}

function details(e: BabyEventDTO, now: number): string {
  const parts: string[] = [];
  if (e.kind !== "diaper" && !(e.kind === "feed" && (e.data as FeedData | null)?.type === "bottle")) {
    const end = eventEnd(e, now);
    parts.push(
      `${format(new Date(e.startedAt), "HH:mm")}–${e.endedAt ? format(new Date(e.endedAt), "HH:mm") : "сейчас"} · ${formatDuration(end - new Date(e.startedAt).getTime())}`,
    );
  }
  if ((e.data as FeedData | null)?.type === "bottle") {
    parts.push((e.data as FeedData).milk === "breastmilk" ? "сцеженное молоко" : "смесь");
  }
  if (e.note) parts.push(e.note);
  return parts.join(" · ") || "нажмите, чтобы изменить";
}

function BottleForm({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (data: FeedData) => Promise<void>;
}) {
  const [ml, setMl] = useState("");
  const [milk, setMilk] = useState<"formula" | "breastmilk">("formula");

  return (
    <form
      className={styles.inlineForm}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ type: "bottle", ml: Number(ml), milk });
      }}
    >
      <div className={styles.quickMl}>
        {[60, 90, 120, 150].map((v) => (
          <button key={v} type="button" className={Number(ml) === v ? styles.chipOn : styles.chip} onClick={() => setMl(String(v))}>
            {v}
          </button>
        ))}
        <input
          className={styles.input}
          inputMode="numeric"
          value={ml}
          onChange={(e) => setMl(e.target.value.replace(/\D/g, ""))}
          placeholder="мл"
          aria-label="Сколько мл"
        />
      </div>
      <div className={styles.quickMl}>
        <button type="button" className={milk === "formula" ? styles.chipOn : styles.chip} onClick={() => setMilk("formula")}>
          Смесь
        </button>
        <button type="button" className={milk === "breastmilk" ? styles.chipOn : styles.chip} onClick={() => setMilk("breastmilk")}>
          Сцеженное
        </button>
        <button type="submit" className={styles.bigBtn} disabled={busy || !ml}>
          Записать
        </button>
      </div>
    </form>
  );
}

function EventForm({
  kind: fixedKind,
  wokeLabel,
  initial,
  onSave,
  onDelete,
  onCancel,
}: {
  kind?: BabyEventKind;
  wokeLabel: string;
  initial?: BabyEventDTO;
  onSave: (input: EventInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<BabyEventKind>(fixedKind ?? "sleep");
  const [start, setStart] = useState(() => toLocalInput(initial ? new Date(initial.startedAt) : new Date(Date.now() - 60 * 60_000)));
  const [end, setEnd] = useState(() =>
    initial?.endedAt ? toLocalInput(new Date(initial.endedAt)) : initial ? "" : toLocalInput(new Date()),
  );
  const feed = initial?.data as FeedData | null;
  const diaper = initial?.data as DiaperData | null;
  const [feedType, setFeedType] = useState<"breast" | "bottle">(feed?.type ?? "breast");
  const [side, setSide] = useState<"left" | "right">(feed?.side ?? "left");
  const [ml, setMl] = useState(feed?.ml ? String(feed.ml) : "");
  const [pee, setPee] = useState(diaper?.pee ?? true);
  const [poo, setPoo] = useState(diaper?.poo ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const running = Boolean(initial && !initial.endedAt);

  function submit(event: FormEvent) {
    event.preventDefault();
    const data =
      kind === "feed"
        ? feedType === "bottle"
          ? { type: "bottle" as const, ml: Number(ml), milk: feed?.milk ?? ("formula" as const) }
          : { type: "breast" as const, side }
        : kind === "diaper"
          ? { pee, poo }
          : null;
    const instant = kind === "diaper" || (kind === "feed" && feedType === "bottle");
    void onSave({
      kind,
      startedAt: new Date(start).toISOString(),
      endedAt: instant || running ? null : end ? new Date(end).toISOString() : null,
      data,
      note,
    });
  }

  const instant = kind === "diaper" || (kind === "feed" && feedType === "bottle");

  return (
    <form className={styles.eventForm} onSubmit={submit}>
      {!fixedKind ? (
        <div className={styles.quickMl}>
          {(
            [
              ["sleep", "😴 Сон"],
              ["feed", "🍼 Кормление"],
              ["diaper", "🧷 Подгузник"],
            ] as [BabyEventKind, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" className={kind === k ? styles.chipOn : styles.chip} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {kind === "feed" ? (
        <div className={styles.quickMl}>
          <button type="button" className={feedType === "breast" && side === "left" ? styles.chipOn : styles.chip} onClick={() => { setFeedType("breast"); setSide("left"); }}>
            Левая
          </button>
          <button type="button" className={feedType === "breast" && side === "right" ? styles.chipOn : styles.chip} onClick={() => { setFeedType("breast"); setSide("right"); }}>
            Правая
          </button>
          <button type="button" className={feedType === "bottle" ? styles.chipOn : styles.chip} onClick={() => setFeedType("bottle")}>
            Бутылочка
          </button>
          {feedType === "bottle" ? (
            <input className={styles.input} inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ""))} placeholder="мл" aria-label="Сколько мл" />
          ) : null}
        </div>
      ) : null}

      {kind === "diaper" ? (
        <div className={styles.quickMl}>
          <button type="button" className={pee ? styles.chipOn : styles.chip} onClick={() => setPee((v) => !v)}>
            💧 Мокрый
          </button>
          <button type="button" className={poo ? styles.chipOn : styles.chip} onClick={() => setPoo((v) => !v)}>
            💩 Грязный
          </button>
        </div>
      ) : null}

      <div className={styles.timeRow}>
        <label>
          {instant ? "Когда" : "Начало"}
          <input className={styles.input} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        {!instant && !running ? (
          <label>
            {kind === "sleep" ? wokeLabel : "Конец"}
            <input className={styles.input} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required={kind === "sleep"} />
          </label>
        ) : null}
      </div>

      <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка (необязательно)" maxLength={300} />

      <div className={styles.formActions}>
        {onDelete ? (
          <button type="button" className={styles.dangerLink} onClick={() => void onDelete()}>
            Удалить
          </button>
        ) : (
          <span />
        )}
        <div className={styles.btnRow}>
          <button type="button" className={styles.softBtn} onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className={styles.bigBtn}>
            Сохранить
          </button>
        </div>
      </div>
    </form>
  );
}
