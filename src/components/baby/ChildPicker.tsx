"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { deleteChild, saveChild, type ChildDTO } from "@/lib/actions/baby";
import { errorText, unwrap } from "@/lib/action-result";
import { todayKey } from "@/lib/dates";
import styles from "./Baby.module.css";

type Props = {
  kids: ChildDTO[];
  childId: string | null;
  onChange: (id: string) => void;
  onSaved: (child: ChildDTO, isNew: boolean) => void;
  onDeleted: (id: string) => void;
};

/** Switches between children and adds or edits one. With no child yet, asks about the baby. */
export function ChildPicker({ kids, childId, onChange, onSaved, onDeleted }: Props) {
  const [form, setForm] = useState<"new" | string | null>(kids.length === 0 ? "new" : null);
  const editing = form && form !== "new" ? kids.find((c) => c.id === form) : undefined;

  if (kids.length === 0 || form) {
    return (
      <ChildForm
        first={kids.length === 0}
        initial={editing}
        onCancel={kids.length > 0 ? () => setForm(null) : undefined}
        onSaved={(child) => {
          onSaved(child, !editing);
          setForm(null);
        }}
        onDeleted={
          editing
            ? () => {
                onDeleted(editing.id);
                setForm(null);
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className={styles.children}>
      {kids.map((c) => (
        <button
          key={c.id}
          type="button"
          className={c.id === childId ? styles.childOn : styles.child}
          onClick={() => (c.id === childId ? setForm(c.id) : onChange(c.id))}
          title={c.id === childId ? "Изменить данные" : undefined}
        >
          {c.name}
          {c.id === childId ? <span aria-hidden> ✎</span> : null}
        </button>
      ))}
      <button type="button" className={styles.child} onClick={() => setForm("new")}>
        + ребёнок
      </button>
    </div>
  );
}

function ChildForm({
  first,
  initial,
  onSaved,
  onCancel,
  onDeleted,
}: {
  first: boolean;
  initial?: ChildDTO;
  onSaved: (child: ChildDTO) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [sex, setSex] = useState<ChildDTO["sex"]>(initial?.sex ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onSaved(unwrap(await saveChild(initial?.id ?? null, { name, birthDate, sex })));
    } catch (err) {
      setError(errorText(err, "Не удалось сохранить"));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!initial || !onDeleted) return;
    if (!window.confirm(`Удалить ${initial.name} и все записи о малыше? Это нельзя отменить.`)) return;
    const result = await deleteChild(initial.id);
    if (result.ok) onDeleted();
    else setError(result.error);
  }

  return (
    <form className={styles.childForm} onSubmit={submit}>
      {first ? (
        <div className={styles.welcome}>
          <Image src="/mascot.webp" alt="" width={640} height={1028} className={styles.welcomeMascot} />
          <div>
            <h1 className={styles.welcomeTitle}>Расскажите о малыше</h1>
            <p className={styles.welcomeText}>
              Отмечайте сон, кормления и подгузники в одно касание, ведите прикорм и смотрите
              статистику. А личный планер — рядом, во вкладке «Планер».
            </p>
          </div>
        </div>
      ) : (
        <h2 className={styles.formTitle}>{initial ? "Данные малыша" : "Ещё один ребёнок"}</h2>
      )}
      <label className={styles.field}>
        Имя
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus={!first} />
      </label>
      <label className={styles.field}>
        Дата рождения
        <input className={styles.input} type="date" value={birthDate} max={todayKey()} onChange={(e) => setBirthDate(e.target.value)} required />
      </label>
      <div className={styles.quickMl}>
        <button type="button" className={sex === "girl" ? styles.chipOn : styles.chip} onClick={() => setSex(sex === "girl" ? null : "girl")}>
          Девочка
        </button>
        <button type="button" className={sex === "boy" ? styles.chipOn : styles.chip} onClick={() => setSex(sex === "boy" ? null : "boy")}>
          Мальчик
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className={styles.formActions}>
        {onDeleted ? (
          <button type="button" className={styles.dangerLink} onClick={() => void remove()}>
            Удалить
          </button>
        ) : (
          <span />
        )}
        <div className={styles.btnRow}>
          {onCancel ? (
            <button type="button" className={styles.softBtn} onClick={onCancel}>
              Отмена
            </button>
          ) : null}
          <button type="submit" className={styles.bigBtn} disabled={pending || !name.trim() || !birthDate}>
            {first ? "Начать" : "Сохранить"}
          </button>
        </div>
      </div>
    </form>
  );
}
