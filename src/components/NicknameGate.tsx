"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setUsernameAction } from "@/lib/actions/nickname";
import styles from "./NicknameGate.module.css";

type Props = {
  suggested: string;
};

export function NicknameGate({ suggested }: Props) {
  const [state, action, pending] = useActionState(setUsernameAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form className={styles.card} action={action}>
      <h1 className={styles.title}>Выберите ник</h1>
      <p className={styles.sub}>
        По нику вас смогут найти, добавить в друзья и позвать в совместное дело.
      </p>
      <div className="field">
        <label htmlFor="username">Ник</label>
        <input
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={20}
          defaultValue={suggested}
          autoComplete="username"
          placeholder="например, данил"
        />
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Сохраняю…" : "Продолжить"}
      </button>
    </form>
  );
}
