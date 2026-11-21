"use client";

import { useActionState, useEffect, useState } from "react";
import type { CodeFlowState } from "@/lib/actions/email-auth";
import { resendCode } from "@/lib/actions/email-auth";
import type { CodePurpose } from "@/lib/email";
import styles from "./AuthForm.module.css";

type Props = {
  email: string;
  purpose: CodePurpose;
  action: (prev: CodeFlowState, formData: FormData) => Promise<CodeFlowState>;
  submitLabel: string;
  /** Asks for a new password too (password reset). */
  withPassword?: boolean;
  onBack: () => void;
};

const RESEND_AFTER = 60;

export function CodeStep({ email, purpose, action, submitLabel, withPassword, onBack }: Props) {
  const [state, formAction, pending] = useActionState(action, { email });
  const [wait, setWait] = useState(RESEND_AFTER);
  const [resendNote, setResendNote] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setResendNote(null);
    const result = await resendCode(email, purpose);
    setResendNote(result.error ?? "Новый код отправлен");
    if (!result.error) setWait(RESEND_AFTER);
  }

  return (
    <div className={styles.form}>
      <form action={formAction} className={styles.fields}>
        <h1 className={styles.title}>Проверьте почту</h1>
        <p className={styles.sub}>
          Мы отправили 6-значный код на <b>{email}</b>. Если письма нет — загляните в «Спам».
        </p>
        <input type="hidden" name="email" value={email} />
        <div className="field">
          <label htmlFor="code">Код из письма</label>
          <input
            id="code"
            name="code"
            className={styles.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="000000"
            required
            autoFocus
          />
        </div>
        {withPassword ? (
          <div className="field">
            <label htmlFor="new-password">Новый пароль</label>
            <input
              id="new-password"
              name="password"
              type="password"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>
        ) : null}

        {state.error ? <p className="form-error">{state.error}</p> : null}
        {state.notice ? <p className={styles.note}>{state.notice}</p> : null}

        <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={pending}>
          {pending ? "Проверяю…" : submitLabel}
        </button>
      </form>

      <div className={styles.codeLinks}>
        <button type="button" onClick={() => void resend()} disabled={wait > 0}>
          {wait > 0 ? `Отправить ещё раз через ${wait} с` : "Отправить код ещё раз"}
        </button>
        <button type="button" onClick={onBack}>
          Изменить почту
        </button>
      </div>
      {resendNote ? <p className={styles.note}>{resendNote}</p> : null}
    </div>
  );
}
