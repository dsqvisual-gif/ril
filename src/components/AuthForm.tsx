"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { appleSignInAction, googleSignInAction } from "@/lib/actions/google";
import { confirmRegistration } from "@/lib/actions/email-auth";
import { CodeStep } from "./CodeStep";
import { PasswordInput } from "./PasswordInput";
import styles from "./AuthForm.module.css";

type State = { error?: string; email?: string };

type Props = {
  mode: "login" | "register";
  action: (prev: State, formData: FormData) => Promise<State>;
  notice?: string | null;
  /** Shows "Sign in with Apple" (only when it is configured). */
  apple?: boolean;
};

export function AuthForm({ mode, action, notice, apple = false }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  // Values typed before a code was sent, to refill the form after "Изменить почту".
  const [values, setValues] = useState<Record<string, string>>({});
  const [backFrom, setBackFrom] = useState<string | null>(null);

  if (mode === "register" && state.email && state.email !== backFrom) {
    return (
      <CodeStep
        email={state.email}
        purpose="register"
        action={confirmRegistration}
        submitLabel="Подтвердить и войти"
        onBack={() => setBackFrom(state.email ?? null)}
      />
    );
  }

  return (
    <div className={styles.form}>
      <form
        action={formAction}
        className={styles.fields}
        onSubmit={(e) => {
          const data = new FormData(e.currentTarget);
          setValues(Object.fromEntries([...data.entries()].map(([k, v]) => [k, String(v)])));
          setBackFrom(null);
        }}
      >
        <h1 className={styles.title}>{mode === "login" ? "Вход" : "Регистрация"}</h1>
        <p className={styles.sub}>
          {mode === "login"
            ? "Войдите по email, нику или через Google"
            : "Имя, ник, почта и пароль — на почту придёт код. Или сразу через Google"}
        </p>

        {mode === "register" ? (
          <>
            <div className="field">
              <label htmlFor="name">Имя</label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                autoComplete="name"
                defaultValue={values.name}
              />
            </div>
            <div className="field">
              <label htmlFor="username">Ник</label>
              <input
                id="username"
                name="username"
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="danil"
                pattern="@?[A-Za-z0-9_]{3,20}"
                title="Только английские буквы, цифры и _"
                defaultValue={values.username}
              />
              <small className={styles.fieldHint}>Только английские буквы, цифры и _</small>
            </div>
          </>
        ) : null}

        <div className="field">
          <label htmlFor="login">{mode === "login" ? "Email или ник" : "Email"}</label>
          <input
            id="login"
            name={mode === "login" ? "login" : "email"}
            type={mode === "login" ? "text" : "email"}
            required
            autoComplete={mode === "login" ? "username" : "email"}
            defaultValue={mode === "login" ? undefined : values.email}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Пароль</label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {state.error ? <p className="form-error">{state.error}</p> : null}
        {notice ? <p className={styles.note}>{notice}</p> : null}

        <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={pending}>
          {pending ? "Подождите…" : mode === "login" ? "Войти" : "Получить код на почту"}
        </button>

        {mode === "login" ? (
          <div className={styles.extraLinks}>
            <Link href="/login/code">Войти по коду из письма</Link>
            <Link href="/forgot">Забыли пароль?</Link>
          </div>
        ) : null}
      </form>

      <div className={styles.or}>или</div>

      <form action={googleSignInAction}>
        <input type="hidden" name="from" value={mode === "login" ? "/login" : "/register"} />
        <GoogleButton />
      </form>

      {apple ? (
        <form action={appleSignInAction}>
          <input type="hidden" name="from" value={mode === "login" ? "/login" : "/register"} />
          <AppleButton />
        </form>
      ) : null}

      {mode === "register" ? (
        <p className={styles.legal}>
          Регистрируясь, вы соглашаетесь с{" "}
          <Link href="/privacy" target="_blank">
            политикой конфиденциальности
          </Link>
          .
        </p>
      ) : null}

      <p className={styles.switch}>
        {mode === "login" ? (
          <>
            Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
          </>
        ) : (
          <>
            Уже есть аккаунт? <Link href="/login">Войти</Link>
          </>
        )}
      </p>
    </div>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.google} disabled={pending}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.98 10.72A5.4 5.4 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.02-2.33z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        />
      </svg>
      {pending ? "Переходим в Google…" : "Войти через Google"}
    </button>
  );
}

function AppleButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.apple} disabled={pending}>
      <svg width="16" height="19" viewBox="0 0 16 19" aria-hidden>
        <path
          fill="currentColor"
          d="M13.2 10.1c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9C2.9 4.5 1.3 5.5.5 7.1c-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.3 0 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.5 1-1.4 1.3-2.7 1.4-2.8-.1 0-2.7-1-2.7-4.3ZM10.8 3c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4Z"
        />
      </svg>
      {pending ? "Переходим в Apple…" : "Войти через Apple"}
    </button>
  );
}
