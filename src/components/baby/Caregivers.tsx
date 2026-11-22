"use client";

import { useEffect, useState } from "react";
import {
  inviteCaregiver,
  listCaregivers,
  removeCaregiver,
  type CaregiverDTO,
} from "@/lib/actions/baby-care";
import { errorText, unwrap } from "@/lib/action-result";
import styles from "./Baby.module.css";

/** The parent shares the child with dad, grandma or a nanny by nickname. */
export function Caregivers({ childId }: { childId: string }) {
  const [people, setPeople] = useState<CaregiverDTO[]>([]);
  const [nick, setNick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void listCaregivers(childId)
      .then((r) => setPeople(unwrap(r)))
      .catch(() => {});
  }, [childId]);

  // Not a <form>: this sits inside the child's own form.
  async function invite() {
    if (!nick.trim()) return;
    setPending(true);
    setError(null);
    try {
      setPeople(unwrap(await inviteCaregiver(childId, nick)));
      setNick("");
    } catch (err) {
      setError(errorText(err, "Не удалось пригласить"));
    } finally {
      setPending(false);
    }
  }

  async function remove(person: CaregiverDTO) {
    if (!window.confirm(`Убрать доступ у ${person.name}?`)) return;
    const result = await removeCaregiver(person.id);
    if (result.ok) setPeople((prev) => prev.filter((p) => p.id !== person.id));
    else setError(result.error);
  }

  return (
    <div className={styles.share}>
      <p className={styles.fieldLabel}>Кто ещё отмечает малыша</p>
      <p className={styles.hint}>
        Пригласите папу, бабушку или няню по нику — вы будете видеть записи друг друга.
      </p>
      {people.length > 0 ? (
        <ul className={styles.people}>
          {people.map((p) => (
            <li key={p.id}>
              <span>
                <b>{p.name}</b> {p.username ? `@${p.username}` : ""}
                {p.status === "invited" ? <small> · ждёт подтверждения</small> : null}
              </span>
              <button type="button" className={styles.dangerLink} onClick={() => void remove(p)}>
                Убрать
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.quickMl}>
        <input
          className={styles.input}
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="ник, например papa"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Ник"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void invite();
            }
          }}
        />
        <button type="button" className={styles.softBtn} disabled={pending || !nick.trim()} onClick={() => void invite()}>
          Пригласить
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
