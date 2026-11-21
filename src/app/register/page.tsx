import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { AuthForm } from "@/components/AuthForm";
import { MascotIdle } from "@/components/MascotIdle";
import { startRegistration } from "@/lib/actions/email-auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { socialProviders } from "@/lib/auth";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Регистрация — Uspeyka",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand href="/" />
      </header>
      <main className={styles.wrap}>
        <MascotIdle className={styles.mascot} />
        <AuthForm
          mode="register"
          action={startRegistration}
          notice={authErrorMessage(params.error)}
          apple={socialProviders.apple}
        />
      </main>
    </div>
  );
}
