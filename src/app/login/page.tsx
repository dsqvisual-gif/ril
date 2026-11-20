import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { MascotIdle } from "@/components/MascotIdle";
import { loginAction } from "@/lib/actions/login";
import { authErrorMessage } from "@/lib/auth-errors";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Вход — Uspeyka",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          Uspeyka
        </Link>
      </header>
      <main className={styles.wrap}>
        <MascotIdle className={styles.mascot} />
        <AuthForm mode="login" action={loginAction} notice={authErrorMessage(params.error)} />
      </main>
    </div>
  );
}
