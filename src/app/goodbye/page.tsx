import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { SignOutNow } from "@/components/SignOutNow";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Аккаунт удалён — Uspeyka",
};

export default function GoodbyePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand href="/" />
      </header>
      <main className={styles.wrap}>
        <SignOutNow />
      </main>
    </div>
  );
}
