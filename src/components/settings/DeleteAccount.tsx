"use client";

import { useActionState, useState } from "react";
import { deleteMyAccount } from "@/lib/actions/account";
import styles from "./Settings.module.css";

export function DeleteAccount({ confirmWord }: { confirmWord: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteMyAccount, {});

  return (
    <div className={`${styles.card} ${styles.danger}`}>
      <h2 className={styles.dangerTitle}>Удаление аккаунта</h2>
      <p className={styles.hint}>
        Удалятся все ваши дела, цели, записи, друзья и достижения. Компании, которыми вы владеете,
        перейдут другим участникам. Отменить удаление нельзя. На эту почту потом можно будет
        зарегистрироваться заново.
      </p>
      {open ? (
        <form action={action} className={styles.confirm}>
          <label htmlFor="confirm">
            Чтобы подтвердить, введите <b>{confirmWord}</b>
          </label>
          <input
            id="confirm"
            name="confirm"
            className={styles.input}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            required
            autoFocus
          />
          {state.error ? <p className="form-error">{state.error}</p> : null}
          <div className={styles.actions}>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className={`btn ${styles.deleteBtn}`} disabled={pending}>
              {pending ? "Удаляю…" : "Удалить навсегда"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={`btn ${styles.deleteBtn}`} onClick={() => setOpen(true)}>
          Удалить аккаунт
        </button>
      )}
    </div>
  );
}
