"use client";

import { useCallback, useState, type FormEvent } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  addGoalEntry,
  addGoalStep,
  createGoal,
  deleteGoal,
  deleteGoalEntry,
  deleteGoalStep,
  setGoalDone,
  toggleGoalStep,
  type GoalDTO,
} from "@/lib/actions/goals";
import { errorText, unwrap, type ActionResult } from "@/lib/action-result";
import { fromDateKey, todayKey } from "@/lib/dates";
import { AchievementToast } from "./AchievementToast";
import { DoneCelebration } from "./DoneCelebration";
import { MascotIdle } from "./MascotIdle";
import styles from "./GoalsBoard.module.css";

type Props = {
  initialGoals: GoalDTO[];
};

export function GoalsBoard({ initialGoals }: Props) {
  const [goals, setGoals] = useState(initialGoals);
  const [openId, setOpenId] = useState<string | null>(initialGoals.find((g) => !g.doneAt)?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cheerKey, setCheerKey] = useState(0);
  const dismissCheer = useCallback(() => setCheerKey(0), []);

  const active = goals.filter((g) => !g.doneAt);
  const achieved = goals.filter((g) => g.doneAt);

  function replace(goal: GoalDTO) {
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
  }

  /** Runs a goal action, swaps in the fresh goal and reports errors. Resolves true on success. */
  async function run(
    key: string,
    action: () => Promise<ActionResult<GoalDTO>>,
    fallback: string,
  ): Promise<GoalDTO | null> {
    setBusy(key);
    try {
      const goal = unwrap(await action());
      replace(goal);
      return goal;
    } catch (err) {
      setToast(errorText(err, fallback));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate(input: { title: string; why: string; deadline: string }) {
    setBusy("new");
    try {
      const goal = unwrap(await createGoal(input));
      setGoals((prev) => [goal, ...prev]);
      setOpenId(goal.id);
      return true;
    } catch (err) {
      setToast(errorText(err, "Не удалось добавить цель"));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleDone(goal: GoalDTO, done: boolean) {
    const fresh = await run(goal.id, () => setGoalDone(goal.id, done), "Не удалось обновить цель");
    if (fresh && done) {
      setCheerKey((k) => k + 1);
      setOpenId(null);
    }
  }

  async function handleDelete(goal: GoalDTO) {
    if (!window.confirm(`Удалить цель «${goal.title}» со всеми шагами и записями?`)) return;
    setBusy(goal.id);
    try {
      unwrap(await deleteGoal(goal.id));
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    } catch (err) {
      setToast(errorText(err, "Не удалось удалить цель"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Цели</h1>
        <p className={styles.lead}>
          Запиши, к чему идёшь, разбей на шаги и отмечай, что уже сделано.
        </p>
      </header>

      <NewGoalForm busy={busy === "new"} onCreate={handleCreate} />

      {goals.length === 0 ? (
        <div className={styles.empty}>
          <MascotIdle className={styles.emptyMascot} />
          <p className={styles.emptyTitle}>Пока ни одной цели</p>
          <p className={styles.emptyText}>
            Начни с чего-то конкретного: «Прочитать 5 книг», «Пробежать 10 км», «Выучить 300
            слов».
          </p>
        </div>
      ) : null}

      {active.length > 0 ? (
        <div className={styles.list}>
          {active.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              open={openId === goal.id}
              busy={busy}
              onToggleOpen={() => setOpenId((id) => (id === goal.id ? null : goal.id))}
              onDone={() => void handleDone(goal, true)}
              onDelete={() => void handleDelete(goal)}
              onAddStep={(title) =>
                run(`step:${goal.id}`, () => addGoalStep(goal.id, title), "Не удалось добавить шаг")
              }
              onToggleStep={(stepId) =>
                void run(stepId, () => toggleGoalStep(stepId), "Не удалось отметить шаг")
              }
              onDeleteStep={(stepId) =>
                void run(stepId, () => deleteGoalStep(stepId), "Не удалось удалить шаг")
              }
              onAddEntry={(text) =>
                run(`entry:${goal.id}`, () => addGoalEntry(goal.id, text), "Не удалось записать")
              }
              onDeleteEntry={(entryId) =>
                void run(entryId, () => deleteGoalEntry(entryId), "Не удалось удалить запись")
              }
            />
          ))}
        </div>
      ) : null}

      {achieved.length > 0 ? (
        <div className={styles.achieved}>
          <h2 className={styles.sectionTitle}>Достигнуто · {achieved.length}</h2>
          {achieved.map((goal) => (
            <article key={goal.id} className={styles.achievedRow}>
              <span className={styles.trophy} aria-hidden>
                ★
              </span>
              <div className={styles.achievedBody}>
                <p className={styles.achievedTitle}>{goal.title}</p>
                <p className={styles.muted}>
                  {format(new Date(goal.doneAt!), "d MMMM yyyy", { locale: ru })}
                  {goal.entries.length > 0 ? ` · ${goal.entries.length} ${plural(goal.entries.length, ["запись", "записи", "записей"])}` : ""}
                </p>
              </div>
              <button
                type="button"
                className={styles.linkBtn}
                disabled={busy === goal.id}
                onClick={() => void handleDone(goal, false)}
              >
                Вернуть
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Удалить цель"
                disabled={busy === goal.id}
                onClick={() => void handleDelete(goal)}
              >
                ×
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {cheerKey > 0 ? <DoneCelebration key={cheerKey} onDone={dismissCheer} /> : null}
      {toast ? <AchievementToast title={toast} onClose={() => setToast(null)} /> : null}
    </section>
  );
}

function NewGoalForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (input: { title: string; why: string; deadline: string }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [deadline, setDeadline] = useState("");
  const [more, setMore] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (await onCreate({ title, why, deadline })) {
      setTitle("");
      setWhy("");
      setDeadline("");
      setMore(false);
    }
  }

  return (
    <form className={styles.newGoal} onSubmit={submit}>
      <div className={styles.newRow}>
        <input
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Новая цель — например, «Прочитать 5 книг»"
          maxLength={140}
          aria-label="Цель"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
          Добавить
        </button>
      </div>
      {more ? (
        <div className={styles.moreFields}>
          <label className={styles.label}>
            Зачем это мне
            <input
              className={styles.input}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Чтобы не забыть, ради чего стараешься"
              maxLength={300}
            />
          </label>
          <label className={styles.label}>
            К какому сроку
            <input
              className={styles.input}
              type="date"
              value={deadline}
              min={todayKey()}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <button type="button" className={styles.linkBtn} onClick={() => setMore(true)}>
          + срок и зачем
        </button>
      )}
    </form>
  );
}

type CardProps = {
  goal: GoalDTO;
  open: boolean;
  busy: string | null;
  onToggleOpen: () => void;
  onDone: () => void;
  onDelete: () => void;
  onAddStep: (title: string) => Promise<GoalDTO | null>;
  onToggleStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  onAddEntry: (text: string) => Promise<GoalDTO | null>;
  onDeleteEntry: (entryId: string) => void;
};

function GoalCard({
  goal,
  open,
  busy,
  onToggleOpen,
  onDone,
  onDelete,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onAddEntry,
  onDeleteEntry,
}: CardProps) {
  const [step, setStep] = useState("");
  const [entry, setEntry] = useState("");
  const doneSteps = goal.steps.filter((s) => s.done).length;
  const total = goal.steps.length;
  const percent = total > 0 ? Math.round((doneSteps / total) * 100) : 0;
  const deadline = deadlineLabel(goal.deadline);

  async function submitStep(event: FormEvent) {
    event.preventDefault();
    if (!step.trim()) return;
    if (await onAddStep(step)) setStep("");
  }

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    if (!entry.trim()) return;
    if (await onAddEntry(entry)) setEntry("");
  }

  return (
    <article className={`${styles.card} ${open ? styles.cardOpen : ""}`}>
      <button type="button" className={styles.cardHead} onClick={onToggleOpen} aria-expanded={open}>
        <div className={styles.cardHeadText}>
          <p className={styles.goalTitle}>{goal.title}</p>
          <div className={styles.metaRow}>
            {deadline ? (
              <span className={`${styles.chip} ${deadline.late ? styles.chipLate : ""}`}>
                {deadline.text}
              </span>
            ) : null}
            <span className={styles.muted}>
              {total > 0
                ? `${doneSteps} из ${total} ${plural(total, ["шаг", "шага", "шагов"])}`
                : "шагов пока нет"}
              {goal.entries.length > 0
                ? ` · ${goal.entries.length} ${plural(goal.entries.length, ["запись", "записи", "записей"])}`
                : ""}
            </span>
          </div>
        </div>
        <span className={styles.percent}>{total > 0 ? `${percent}%` : ""}</span>
        <span className={styles.chevron} aria-hidden>
          ›
        </span>
      </button>

      <div className={styles.progress} aria-hidden>
        <span style={{ width: `${percent}%` }} />
      </div>

      {open ? (
        <div className={styles.cardBody}>
          {goal.why ? <p className={styles.why}>Зачем: {goal.why}</p> : null}

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>Шаги</h3>
            {goal.steps.length > 0 ? (
              <ul className={styles.steps}>
                {goal.steps.map((s) => (
                  <li key={s.id} className={s.done ? styles.stepDone : undefined}>
                    <button
                      type="button"
                      className={styles.check}
                      aria-label={s.done ? "Снять отметку" : "Отметить выполненным"}
                      disabled={busy === s.id}
                      onClick={() => onToggleStep(s.id)}
                    >
                      {s.done ? "✓" : ""}
                    </button>
                    <span className={styles.stepTitle}>{s.title}</span>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Удалить шаг"
                      disabled={busy === s.id}
                      onClick={() => onDeleteStep(s.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.hint}>Разбей цель на понятные шаги — так видно прогресс.</p>
            )}
            <form className={styles.inlineForm} onSubmit={submitStep}>
              <input
                className={styles.input}
                value={step}
                onChange={(e) => setStep(e.target.value)}
                placeholder="Новый шаг"
                maxLength={140}
                aria-label="Новый шаг"
              />
              <button
                type="submit"
                className="btn btn-ghost"
                disabled={busy === `step:${goal.id}` || !step.trim()}
              >
                Добавить
              </button>
            </form>
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>Что сделано</h3>
            <form className={styles.entryForm} onSubmit={submitEntry}>
              <textarea
                className={styles.textarea}
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="Что сегодня сделал для этой цели? Например: «прочитал 30 страниц»"
                maxLength={500}
                rows={2}
                aria-label="Что сделано"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy === `entry:${goal.id}` || !entry.trim()}
              >
                Записать
              </button>
            </form>
            {goal.entries.length > 0 ? (
              <ul className={styles.entries}>
                {goal.entries.map((e) => (
                  <li key={e.id}>
                    <span className={styles.entryDate}>
                      {format(new Date(e.createdAt), "d MMM", { locale: ru })}
                    </span>
                    <p className={styles.entryText}>{e.text}</p>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Удалить запись"
                      disabled={busy === e.id}
                      onClick={() => onDeleteEntry(e.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={styles.cardFooter}>
            <button
              type="button"
              className={`btn ${styles.doneBtn}`}
              disabled={busy === goal.id}
              onClick={onDone}
            >
              Цель достигнута
            </button>
            <button
              type="button"
              className={styles.dangerLink}
              disabled={busy === goal.id}
              onClick={onDelete}
            >
              Удалить цель
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function deadlineLabel(deadline: string | null): { text: string; late: boolean } | null {
  if (!deadline) return null;
  const days = differenceInCalendarDays(fromDateKey(deadline), fromDateKey(todayKey()));
  const date = format(fromDateKey(deadline), "d MMM", { locale: ru });
  if (days < 0) return { text: `срок прошёл · ${date}`, late: true };
  if (days === 0) return { text: "срок сегодня", late: true };
  return { text: `до ${date} · ${days} ${plural(days, ["день", "дня", "дней"])}`, late: false };
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
