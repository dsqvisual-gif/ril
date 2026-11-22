"use client";

import { useState, type FormEvent } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  createReminder,
  deleteReminder,
  sendDigestNow,
  setDigest,
  setHealthEmails,
  updateReminder,
  type ReminderDTO,
  type ReminderInput,
} from "@/lib/actions/reminders";
import { errorText, unwrap } from "@/lib/action-result";
import { fromDateKey, todayKey } from "@/lib/dates";
import {
  REMIND_BEFORE,
  REPEAT_PRESETS,
  describeIn,
  describeRepeat,
  type RepeatUnit,
} from "@/lib/reminders";
import styles from "./Settings.module.css";

type Props = {
  digestEnabled: boolean;
  initialReminders: ReminderDTO[];
};

export function DigestSettings({
  digestEnabled,
  healthEmails,
  momMode,
}: {
  digestEnabled: boolean;
  healthEmails: boolean;
  momMode: boolean;
}) {
  const [enabled, setEnabled] = useState(digestEnabled);
  const [health, setHealth] = useState(healthEmails);

  async function toggleHealth(next: boolean) {
    setHealth(next);
    const result = await setHealthEmails(next);
    if (!result.ok) {
      setHealth(!next);
      setNote(result.error);
    }
  }
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setEnabled(next);
    const result = await setDigest(next);
    if (!result.ok) {
      setEnabled(!next);
      setNote(result.error);
    }
  }

  async function test() {
    setBusy(true);
    setNote(null);
    const result = await sendDigestNow();
    setBusy(false);
    setNote(result.ok ? result.data : result.error);
  }

  return (
    <div className={styles.card}>
      <label className={styles.switchRow}>
        <span>
          <b>Утреннее письмо с планом на день</b>
          <small>Около 6–7 утра: дела на сегодня, важные и срочные — первыми. Если дел нет, письма не будет.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className={styles.switch}
          checked={enabled}
          onChange={(e) => void toggle(e.target.checked)}
        />
      </label>
      {momMode ? (
        <label className={styles.switchRow}>
          <span>
            <b>Напоминания о прививках и визитах</b>
            <small>Письмо за несколько дней до записи в разделе «Здоровье».</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            className={styles.switch}
            checked={health}
            onChange={(e) => void toggleHealth(e.target.checked)}
          />
        </label>
      ) : null}
      <button type="button" className={styles.linkBtn} onClick={() => void test()} disabled={busy}>
        {busy ? "Отправляю…" : "Прислать пробное письмо сейчас"}
      </button>
      {note ? <p className={styles.hint}>{note}</p> : null}
    </div>
  );
}

export function RemindersSettings({ initialReminders }: Omit<Props, "digestEnabled">) {
  const [items, setItems] = useState(initialReminders);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayKey();

  async function save(id: string | "new", input: ReminderInput) {
    setError(null);
    try {
      const saved = unwrap(id === "new" ? await createReminder(input) : await updateReminder(id, input));
      setItems((prev) =>
        (id === "new" ? [...prev, saved] : prev.map((r) => (r.id === id ? saved : r))).sort((a, b) =>
          a.nextDate.localeCompare(b.nextDate),
        ),
      );
      setEditing(null);
    } catch (err) {
      setError(errorText(err, "Не удалось сохранить"));
    }
  }

  async function remove(item: ReminderDTO) {
    if (!window.confirm(`Удалить напоминание «${item.title}»?`)) return;
    const result = await deleteReminder(item.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.filter((r) => r.id !== item.id));
  }

  return (
    <div className={styles.card}>
      <p className={styles.hint}>
        Для того, что повторяется: чекап 4 раза в год, замена фильтра, оплата страховки. Мы
        посчитаем даты, заранее пришлём письмо и в нужный день добавим дело в планер.
      </p>

      {items.length > 0 ? (
        <ul className={styles.reminders}>
          {items.map((r) =>
            editing === r.id ? (
              <li key={r.id}>
                <ReminderForm
                  initial={r}
                  onSave={(input) => save(r.id, input)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={r.id} className={styles.reminder}>
                <div>
                  <p className={styles.reminderTitle}>{r.title}</p>
                  <p className={styles.reminderMeta}>
                    {describeRepeat(r.everyCount, r.everyUnit)} · следующий раз{" "}
                    <b>{format(fromDateKey(r.nextDate), "d MMMM yyyy", { locale: ru })}</b> (
                    {describeIn(today, r.nextDate)})
                  </p>
                  <p className={styles.reminderMeta}>
                    Письмо {REMIND_BEFORE.find((o) => o.days === r.remindDaysBefore)?.label ?? `за ${r.remindDaysBefore} дн.`}
                    {r.addToPlanner ? " · появится в планере" : ""}
                  </p>
                </div>
                <div className={styles.reminderActions}>
                  <button type="button" className={styles.linkBtn} onClick={() => setEditing(r.id)}>
                    Изменить
                  </button>
                  <button type="button" className={styles.dangerLink} onClick={() => void remove(r)}>
                    Удалить
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      {editing === "new" ? (
        <ReminderForm onSave={(input) => save("new", input)} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" className="btn btn-ghost" onClick={() => setEditing("new")}>
          + Добавить напоминание
        </button>
      )}
    </div>
  );
}

function ReminderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ReminderDTO;
  onSave: (input: ReminderInput) => Promise<void>;
  onCancel: () => void;
}) {
  const presetOf = (count: number, unit: RepeatUnit) =>
    REPEAT_PRESETS.find((p) => p.count === count && p.unit === unit)?.id ?? "custom";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [preset, setPreset] = useState(initial ? presetOf(initial.everyCount, initial.everyUnit) : "quarter");
  const [count, setCount] = useState(initial?.everyCount ?? 3);
  const [unit, setUnit] = useState<RepeatUnit>(initial?.everyUnit ?? "month");
  const [nextDate, setNextDate] = useState(initial?.nextDate ?? "");
  const [before, setBefore] = useState(initial?.remindDaysBefore ?? 7);
  const [addToPlanner, setAddToPlanner] = useState(initial?.addToPlanner ?? true);
  const [pending, setPending] = useState(false);

  function pickPreset(id: string) {
    setPreset(id);
    const p = REPEAT_PRESETS.find((x) => x.id === id);
    if (p) {
      setCount(p.count);
      setUnit(p.unit);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    await onSave({ title, everyCount: count, everyUnit: unit, nextDate, remindDaysBefore: before, addToPlanner });
    setPending(false);
  }

  return (
    <form className={styles.reminderForm} onSubmit={submit}>
      <label className={styles.field}>
        О чём напомнить
        <input
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: чекап у врача"
          maxLength={100}
          required
          autoFocus
        />
      </label>

      <label className={styles.field}>
        Как часто
        <select className={styles.input} value={preset} onChange={(e) => pickPreset(e.target.value)}>
          {REPEAT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Свой вариант…</option>
        </select>
      </label>

      {preset === "custom" ? (
        <div className={styles.customRepeat}>
          <span>каждые</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={365}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Сколько"
          />
          <select
            className={styles.input}
            value={unit}
            onChange={(e) => setUnit(e.target.value as RepeatUnit)}
            aria-label="Чего"
          >
            <option value="day">дней</option>
            <option value="week">недель</option>
            <option value="month">месяцев</option>
            <option value="year">лет</option>
          </select>
        </div>
      ) : null}

      <div className={styles.twoCols}>
        <label className={styles.field}>
          Когда в следующий раз
          <input
            className={styles.input}
            type="date"
            value={nextDate}
            min={todayKey()}
            onChange={(e) => setNextDate(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          Прислать письмо
          <select className={styles.input} value={before} onChange={(e) => setBefore(Number(e.target.value))}>
            {REMIND_BEFORE.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={addToPlanner}
          onChange={(e) => setAddToPlanner(e.target.checked)}
        />
        Добавить в планер в этот день
      </label>

      {nextDate ? (
        <p className={styles.hint}>
          Повторяется {describeRepeat(count, unit)}, начиная с{" "}
          {format(fromDateKey(nextDate), "d MMMM yyyy", { locale: ru })}.
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || !title.trim() || !nextDate}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
