"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { ChildDTO } from "@/lib/actions/baby";
import {
  deleteHealth,
  listHealth,
  saveHealth,
  setHealthDone,
  type HealthDTO,
  type HealthInput,
  type HealthKind,
} from "@/lib/actions/baby-care";
import { errorText, unwrap } from "@/lib/action-result";
import { fromDateKey, todayKey } from "@/lib/dates";
import { REMIND_BEFORE, describeIn } from "@/lib/reminders";
import { AchievementToast } from "../AchievementToast";
import styles from "./Baby.module.css";

const VISIT_PRESETS = ["Осмотр педиатра", "Невролог", "Ортопед", "Окулист", "ЛОР", "Стоматолог", "Анализы", "УЗИ"];
const VACCINE_PRESETS = ["Прививка", "Плановая прививка"];

export function HealthBoard({ kids }: { kids: ChildDTO[] }) {
  const [childId, setChildId] = useState(kids[0]?.id ?? null);
  const child = kids.find((c) => c.id === childId) ?? null;

  if (!child) {
    return (
      <section className={styles.root}>
        <p className={styles.emptyBig}>
          Сначала добавьте малыша на вкладке <Link href="/app/baby">«Малыш»</Link>.
        </p>
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
      <Health key={child.id} child={child} />
    </section>
  );
}

function Health({ child }: { child: ChildDTO }) {
  const today = todayKey();
  const [items, setItems] = useState<HealthDTO[] | null>(null);
  const [form, setForm] = useState<"new" | string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void listHealth(child.id)
      .then((r) => setItems(unwrap(r)))
      .catch((err) => setToast(errorText(err, "Не удалось загрузить")));
  }, [child.id]);

  const upcoming = (items ?? []).filter((h) => !h.done);
  const done = (items ?? []).filter((h) => h.done).reverse();

  async function save(id: string | null, input: HealthInput) {
    try {
      const saved = unwrap(await saveHealth(child.id, id, input));
      setItems((prev) =>
        [...(prev ?? []).filter((h) => h.id !== saved.id), saved].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setForm(null);
    } catch (err) {
      setToast(errorText(err, "Не удалось сохранить"));
    }
  }

  async function toggle(item: HealthDTO) {
    const r = await setHealthDone(item.id, !item.done);
    if (r.ok) setItems((prev) => (prev ?? []).map((h) => (h.id === item.id ? r.data : h)));
    else setToast(r.error);
  }

  async function remove(item: HealthDTO) {
    if (!window.confirm(`Удалить «${item.title}»?`)) return;
    const r = await deleteHealth(item.id);
    if (r.ok) setItems((prev) => (prev ?? []).filter((h) => h.id !== item.id));
    else setToast(r.error);
  }

  const row = (h: HealthDTO) =>
    form === h.id ? (
      <li key={h.id}>
        <HealthForm initial={h} onSave={(input) => save(h.id, input)} onCancel={() => setForm(null)} onDelete={() => void remove(h)} />
      </li>
    ) : (
      <li key={h.id} className={`${styles.healthRow} ${h.done ? styles.healthDone : ""}`}>
        <button type="button" className={styles.healthCheck} onClick={() => void toggle(h)} aria-label={h.done ? "Отметить как не сделанное" : "Отметить сделанным"}>
          {h.done ? "✓" : ""}
        </button>
        <button type="button" className={styles.healthBody} onClick={() => setForm(h.id)}>
          <b>
            {h.kind === "vaccine" ? "💉" : "🩺"} {h.title}
          </b>
          <small>
            {format(fromDateKey(h.date), "d MMMM yyyy", { locale: ru })}
            {!h.done ? ` · ${h.date < today ? "дата прошла — отметьте, если были" : describeIn(today, h.date)}` : ""}
            {h.note ? ` · ${h.note}` : ""}
          </small>
        </button>
      </li>
    );

  return (
    <>
      <div className={styles.headline}>
        <h1 className={styles.childName}>Здоровье</h1>
        <span className={styles.age}>{child.name}</span>
      </div>
      <p className={styles.hint}>
        Прививки и визиты к врачу: запишите дату — за несколько дней придёт письмо всем, кто отмечает малыша. График прививок
        уточняйте у педиатра.
      </p>

      {form === "new" ? (
        <HealthForm onSave={(input) => save(null, input)} onCancel={() => setForm(null)} />
      ) : (
        <button type="button" className={styles.bigBtnWide} onClick={() => setForm("new")}>
          + Прививка или визит
        </button>
      )}

      {items === null ? <p className={styles.hint}>Загружаю…</p> : null}
      {upcoming.length > 0 ? (
        <>
          <h2 className={styles.groupTitle}>Впереди</h2>
          <ul className={styles.healthList}>{upcoming.map(row)}</ul>
        </>
      ) : null}
      {done.length > 0 ? (
        <>
          <h2 className={styles.groupTitle}>Сделано</h2>
          <ul className={styles.healthList}>{done.map(row)}</ul>
        </>
      ) : null}

      {toast ? <AchievementToast kind="error" title={toast} onClose={() => setToast(null)} /> : null}
    </>
  );
}

function HealthForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: HealthDTO;
  onSave: (input: HealthInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [kind, setKind] = useState<HealthKind>(initial?.kind ?? "visit");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [remind, setRemind] = useState(initial?.remindDaysBefore ?? 3);
  const [note, setNote] = useState(initial?.note ?? "");
  const [pending, setPending] = useState(false);
  const presets = kind === "vaccine" ? VACCINE_PRESETS : VISIT_PRESETS;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    await onSave({ kind, title, date, remindDaysBefore: remind, note });
    setPending(false);
  }

  return (
    <form className={styles.eventForm} onSubmit={submit}>
      <div className={styles.quickMl}>
        <button type="button" className={kind === "visit" ? styles.chipOn : styles.chip} onClick={() => setKind("visit")}>
          🩺 Визит к врачу
        </button>
        <button type="button" className={kind === "vaccine" ? styles.chipOn : styles.chip} onClick={() => setKind("vaccine")}>
          💉 Прививка
        </button>
      </div>
      <div className={styles.quickMl}>
        {presets.map((p) => (
          <button key={p} type="button" className={title === p ? styles.chipOn : styles.chipSoft} onClick={() => setTitle(p)}>
            {p}
          </button>
        ))}
      </div>
      <label className={styles.field}>
        Название
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={kind === "vaccine" ? "Например: АКДС" : "Например: осмотр педиатра"} required />
      </label>
      <div className={styles.timeRow}>
        <label>
          Дата
          <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Напомнить на почту
          <select className={styles.input} value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
            {REMIND_BEFORE.filter((o) => o.days <= 14).map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка: кабинет, что взять с собой…" maxLength={300} />
      <div className={styles.formActions}>
        {onDelete ? (
          <button type="button" className={styles.dangerLink} onClick={onDelete}>
            Удалить
          </button>
        ) : (
          <span />
        )}
        <div className={styles.btnRow}>
          <button type="button" className={styles.softBtn} onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className={styles.bigBtn} disabled={pending || !title.trim() || !date}>
            Сохранить
          </button>
        </div>
      </div>
    </form>
  );
}
