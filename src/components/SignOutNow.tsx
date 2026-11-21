"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { endSession } from "@/lib/actions/logout";
import styles from "./AuthForm.module.css";

/** Clears the session of an account that no longer exists. */
export function SignOutNow() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    void endSession()
      .catch(() => {})
      .finally(() => setDone(true));
  }, []);

  return (
    <div className={styles.form}>
      <h1 className={styles.title}>Аккаунт удалён</h1>
      <p className={styles.sub}>
        Этого аккаунта больше нет. На ту же почту можно зарегистрироваться заново.
      </p>
      <Link href="/register" className="btn btn-primary" aria-disabled={!done}>
        Зарегистрироваться
      </Link>
    </div>
  );
}
