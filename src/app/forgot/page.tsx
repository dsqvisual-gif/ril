import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { EmailCodeFlow } from "@/components/EmailCodeFlow";
import { MascotIdle } from "@/components/MascotIdle";
import { requestResetCode, resetPassword } from "@/lib/actions/email-auth";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Восстановление пароля — Uspeyka",
};

export default function ForgotPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand href="/" />
      </header>
      <main className={styles.wrap}>
        <MascotIdle className={styles.mascot} />
        <EmailCodeFlow
          purpose="reset"
          title="Восстановление пароля"
          sub="Укажите почту аккаунта — пришлём код, и вы зададите новый пароль."
          request={requestResetCode}
          verify={resetPassword}
          verifyLabel="Сохранить пароль и войти"
          withPassword
        />
      </main>
    </div>
  );
}
