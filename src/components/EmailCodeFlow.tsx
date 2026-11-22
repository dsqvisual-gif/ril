"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { CodeFlowState } from "@/lib/actions/email-auth";
import type { CodePurpose } from "@/lib/email";
import { BotGuard } from "./BotGuard";
import { CodeStep } from "./CodeStep";
import styles from "./AuthForm.module.css";

type Props = {
  purpose: Exclude<CodePurpose, "register">;
  title: string;
  sub: string;
  request: (prev: CodeFlowState, formData: FormData) => Promise<CodeFlowState>;
  verify: (prev: CodeFlowState, formData: FormData) => Promise<CodeFlowState>;
  verifyLabel: string;
  withPassword?: boolean;
};

/** Two steps: type your email, then the code sent to it. */
export function EmailCodeFlow({
  purpose,
  title,
  sub,
  request,
  verify,
  verifyLabel,
  withPassword,
}: Props) {
  const [state, formAction, pending] = useActionState(request, {});
  const [backFrom, setBackFrom] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  if (state.email && state.email !== backFrom) {
    return (
      <CodeStep
        email={state.email}
        purpose={purpose}
        action={verify}
        submitLabel={verifyLabel}
        withPassword={withPassword}
        onBack={() => setBackFrom(state.email ?? null)}
      />
    );
  }

  return (
    <div className={styles.form}>
      <form
        action={formAction}
        className={styles.fields}
        onSubmit={() => setBackFrom(null)}
      >
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>{sub}</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <BotGuard resetKey={state} />
        {state.error ? <p className="form-error">{state.error}</p> : null}
        <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={pending}>
          {pending ? "Отправляю…" : "Прислать код"}
        </button>
      </form>
      <p className={styles.switch}>
        Вспомнили пароль? <Link href="/login">Войти</Link>
      </p>
    </div>
  );
}
