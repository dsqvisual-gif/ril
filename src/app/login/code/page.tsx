import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { EmailCodeFlow } from "@/components/EmailCodeFlow";
import { MascotIdle } from "@/components/MascotIdle";
import { loginWithCode, requestLoginCode } from "@/lib/actions/email-auth";
import styles from "../../auth.module.css";

export const metadata: Metadata = {
  title: "Вход по коду — Uspeyka",
};

export default function LoginCodePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand href="/" />
      </header>
      <main className={styles.wrap}>
        <MascotIdle className={styles.mascot} />
        <EmailCodeFlow
          purpose="login"
          title="Вход по коду"
          sub="Без пароля: пришлём на почту код, введёте его — и вы в аккаунте."
          request={requestLoginCode}
          verify={loginWithCode}
          verifyLabel="Войти"
        />
      </main>
    </div>
  );
}
