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
  renameGoalStep,
  setGoalDone,
  setGoalMeasure,
  setGoalSelfProgress,
  toggleGoalStep,
  type CreateGoalInput,
  type GoalDTO,
  type GoalEntryInput,
  type GoalMeasureInput,
} from "@/lib/actions/goals";
import { GOAL_KINDS, formatAmount, goalProgress, type GoalKind } from "@/lib/goal-progress";
import { errorText, unwrap, type ActionResult } from "@/lib/action-result";
import { fromDateKey, todayKey } from "@/lib/dates";
import { AchievementToast } from "./AchievementToast";
import { useAwards } from "./useAwards";
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
  const awards = useAwards();
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
      awards.claim();
      return goal;
    } catch (err) {
      setToast(errorText(err, fallback));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate(input: CreateGoalInput) {
    setBusy("new");
    try {
      const goal = unwrap(await createGoal(input));
      setGoals((prev) => [goal, ...prev]);
      setOpenId(goal.id);
      awards.claim();
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
          Запиши, к чему идёшь, выбери, как считать прогресс, и отмечай, что уже сделано.
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
              onRenameStep={(stepId, title) =>
                run(stepId, () => renameGoalStep(stepId, title), "Не удалось изменить шаг")
              }
              onDeleteStep={(stepId) =>
                void run(stepId, () => deleteGoalStep(stepId), "Не удалось удалить шаг")
              }
              onAddEntry={(input) =>
                run(`entry:${goal.id}`, () => addGoalEntry(goal.id, input), "Не удалось записать")
              }
              onSetMeasure={(input) =>
                run(`measure:${goal.id}`, () => setGoalMeasure(goal.id, input), "Не удалось сохранить")
              }
              onSetFeeling={(value) =>
                run(`feeling:${goal.id}`, () => setGoalSelfProgress(goal.id, value), "Не удалось сохранить")
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
      {toast ? (
        <AchievementToast kind="error" title={toast} onClose={() => setToast(null)} />
      ) : (
        awards.toast
      )}
    </section>
  );
}

function NewGoalForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (input: CreateGoalInput) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [deadline, setDeadline] = useState("");
  const [kind, setKind] = useState<GoalKind>("steps");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [more, setMore] = useState(false);
  const needsTarget = kind === "number" && !(Number(target.replace(",", ".")) > 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || needsTarget) return;
    const ok = await onCreate({
      title,
      why,
      deadline,
      kind,
      target: kind === "number" ? Number(target.replace(",", ".")) : null,
      unit: kind === "number" ? unit : null,
    });
    if (ok) {
      setTitle("");
      setWhy("");
      setDeadline("");
      setTarget("");
      setUnit("");
      setKind("steps");
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
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !title.trim() || needsTarget}
        >
          Добавить
        </button>
      </div>

      <MeasurePicker
        kind={kind}
        target={target}
        unit={unit}
        onKind={setKind}
        onTarget={setTarget}
        onUnit={setUnit}
      />

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

function MeasurePicker({
  kind,
  target,
  unit,
  onKind,
  onTarget,
  onUnit,
}: {
  kind: GoalKind;
  target: string;
  unit: string;
  onKind: (kind: GoalKind) => void;
  onTarget: (value: string) => void;
  onUnit: (value: string) => void;
}) {
  const hint = GOAL_KINDS.find((k) => k.id === kind)?.hint;
  return (
    <div className={styles.measure}>
      <div className={styles.measureRow}>
        <span className={styles.measureLabel}>Прогресс считать</span>
        <div className={styles.kinds} role="radiogroup" aria-label="Как считать прогресс">
          {GOAL_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              className={kind === k.id ? styles.kindActive : undefined}
              onClick={() => onKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.hint}>{hint}</p>
      {kind === "number" ? (
        <div className={styles.targetRow}>
          <label className={styles.label}>
            Сколько нужно
            <input
              className={styles.input}
              inputMode="decimal"
              value={target}
              onChange={(e) => onTarget(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="5"
              aria-label="Сколько нужно"
            />
          </label>
          <label className={styles.label}>
            Чего
            <input
              className={styles.input}
              value={unit}
              onChange={(e) => onUnit(e.target.value)}
              placeholder="книг, км, слов"
              maxLength={20}
              aria-label="Единица"
            />
          </label>
        </div>
      ) : null}
    </div>
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
  onRenameStep: (stepId: string, title: string) => Promise<GoalDTO | null>;
  onDeleteStep: (stepId: string) => void;
  onAddEntry: (input: GoalEntryInput) => Promise<GoalDTO | null>;
  onDeleteEntry: (entryId: string) => void;
  onSetMeasure: (input: GoalMeasureInput) => Promise<GoalDTO | null>;
  onSetFeeling: (value: number) => Promise<GoalDTO | null>;
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
  onRenameStep,
  onDeleteStep,
  onAddEntry,
  onDeleteEntry,
  onSetMeasure,
  onSetFeeling,
}: CardProps) {
  const [step, setStep] = useState("");
  const [entry, setEntry] = useState("");
  const [amount, setAmount] = useState("");
  const [feeling, setFeeling] = useState(goal.selfProgress ?? 0);
  const [editMeasure, setEditMeasure] = useState(false);
  const [mKind, setMKind] = useState<GoalKind>(goal.kind);
  const [mTarget, setMTarget] = useState(goal.target ? formatAmount(goal.target) : "");
  const [mUnit, setMUnit] = useState(goal.unit ?? "");
  const progress = goalProgress(goal);
  const percent = progress.ratio === null ? null : Math.round(progress.ratio * 100);
  const deadline = deadlineLabel(goal.deadline);

  async function submitStep(event: FormEvent) {
    event.preventDefault();
    if (!step.trim()) return;
    if (await onAddStep(step)) setStep("");
  }

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    if (!entry.trim()) return;
    const value = Number(amount.replace(",", "."));
    const ok = await onAddEntry({
      text: entry,
      amount: goal.kind === "number" && amount && Number.isFinite(value) ? value : null,
    });
    if (ok) {
      setEntry("");
      setAmount("");
    }
  }

  async function saveMeasure() {
    const target = Number(mTarget.replace(",", "."));
    const ok = await onSetMeasure({
      kind: mKind,
      target: mKind === "number" ? target : null,
      unit: mKind === "number" ? mUnit : null,
    });
    if (ok) setEditMeasure(false);
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
              {progress.label}
              {goal.entries.length > 0
                ? ` · ${goal.entries.length} ${plural(goal.entries.length, ["запись", "записи", "записей"])}`
                : ""}
            </span>
          </div>
        </div>
        <span className={styles.percent}>{percent === null ? "" : `${percent}%`}</span>
        <span className={styles.chevron} aria-hidden>
          ›
        </span>
      </button>

      <div className={styles.progress} aria-hidden>
        <span style={{ width: `${percent ?? 0}%` }} />
      </div>

      {open ? (
        <div className={styles.cardBody}>
          {goal.why ? <p className={styles.why}>Зачем: {goal.why}</p> : null}

          {goal.kind === "feeling" ? (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Насколько ты ближе к цели</h3>
              <div className={styles.feeling}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={feeling}
                  onChange={(e) => setFeeling(Number(e.target.value))}
                  aria-label="Оценка прогресса"
                />
                <span className={styles.feelingValue}>{feeling}%</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy === `feeling:${goal.id}` || feeling === goal.selfProgress}
                  onClick={() => void onSetFeeling(feeling)}
                >
                  Сохранить
                </button>
              </div>
              <p className={styles.hint}>
                Цифры тут не главное — честно отметь, как ощущаешь движение. Можно менять в любой
                момент.
              </p>
            </div>
          ) : null}

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              {goal.kind === "steps" ? "Шаги" : "Шаги — план, на процент не влияют"}
            </h3>
            {goal.steps.length > 0 ? (
              <ul className={styles.steps}>
                {goal.steps.map((s, index) => (
                  <StepItem
                    key={s.id}
                    number={index + 1}
                    step={s}
                    busy={busy === s.id}
                    onToggle={() => onToggleStep(s.id)}
                    onRename={(title) => onRenameStep(s.id, title)}
                    onDelete={() => onDeleteStep(s.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.hint}>
                {goal.kind === "steps"
                  ? "Разбей цель на понятные шаги — по ним считается прогресс."
                  : "Можно набросать план по шагам — для себя."}
              </p>
            )}
            <form className={styles.inlineForm} onSubmit={submitStep}>
              <input
                className={styles.input}
                value={step}
                onChange={(e) => setStep(e.target.value)}
                placeholder={`Шаг ${goal.steps.length + 1} — что нужно сделать`}
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
              {goal.kind === "number" ? (
                <label className={styles.amount}>
                  <span>+</span>
                  <input
                    className={styles.input}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,-]/g, ""))}
                    placeholder="0"
                    aria-label={`Сколько добавилось${goal.unit ? `, ${goal.unit}` : ""}`}
                  />
                  {goal.unit ? <span className={styles.unit}>{goal.unit}</span> : null}
                </label>
              ) : null}
              <textarea
                className={styles.textarea}
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="Что сегодня сделано для этой цели? Например: «прочитано 30 страниц»"
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
                    <p className={styles.entryText}>
                      {e.amount !== null ? (
                        <b className={styles.entryAmount}>
                          {e.amount > 0 ? "+" : ""}
                          {formatAmount(e.amount)}
                        </b>
                      ) : null}
                      {e.text}
                    </p>
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

          <div className={styles.block}>
            {editMeasure ? (
              <>
                <MeasurePicker
                  kind={mKind}
                  target={mTarget}
                  unit={mUnit}
                  onKind={setMKind}
                  onTarget={setMTarget}
                  onUnit={setMUnit}
                />
                <div className={styles.measureActions}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={
                      busy === `measure:${goal.id}` ||
                      (mKind === "number" && !(Number(mTarget.replace(",", ".")) > 0))
                    }
                    onClick={() => void saveMeasure()}
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setEditMeasure(false)}
                  >
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className={styles.linkBtn} onClick={() => setEditMeasure(true)}>
                Как считается прогресс: {GOAL_KINDS.find((k) => k.id === goal.kind)?.label.toLowerCase()}
                {goal.kind === "number" && goal.target
                  ? ` (${formatAmount(goal.target)}${goal.unit ? ` ${goal.unit}` : ""})`
                  : ""}{" "}
                · изменить
              </button>
            )}
          </div>

          {progress.ratio !== null && progress.ratio >= 1 ? (
            <p className={styles.reached}>Похоже, цель достигнута — отметь это! 🎉</p>
          ) : null}

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

function StepItem({
  number,
  step,
  busy,
  onToggle,
  onRename,
  onDelete,
}: {
  number: number;
  step: { id: string; title: string; done: boolean };
  busy: boolean;
  onToggle: () => void;
  onRename: (title: string) => Promise<GoalDTO | null>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(step.title);

  function startEdit() {
    setDraft(step.title);
    setEditing(true);
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    const title = draft.trim();
    if (!title || title === step.title) {
      setEditing(false);
      return;
    }
    if (await onRename(title)) setEditing(false);
  }

  return (
    <li className={step.done ? styles.stepDone : undefined}>
      <button
        type="button"
        className={styles.check}
        aria-label={step.done ? "Снять отметку" : "Отметить выполненным"}
        disabled={busy}
        onClick={onToggle}
      >
        {step.done ? "✓" : ""}
      </button>
      <span className={styles.stepNum}>Шаг {number}</span>
      {editing ? (
        <form className={styles.stepEdit} onSubmit={save}>
          <input
            className={styles.input}
            value={draft}
            autoFocus
            maxLength={140}
            aria-label={`Что за шаг ${number}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={() => void save()}
          />
        </form>
      ) : (
        <button
          type="button"
          className={styles.stepTitle}
          title="Изменить шаг"
          onClick={startEdit}
        >
          {step.title}
        </button>
      )}
      {!editing ? (
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={`Изменить шаг ${number}`}
          disabled={busy}
          onClick={startEdit}
        >
          ✎
        </button>
      ) : null}
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={`Удалить шаг ${number}`}
        disabled={busy}
        onClick={onDelete}
      >
        ×
      </button>
    </li>
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
