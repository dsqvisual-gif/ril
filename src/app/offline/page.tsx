import type { Metadata } from "next";
import { MascotIdle } from "@/components/MascotIdle";
import { RetryButton } from "@/components/RetryButton";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Нет интернета — Uspeyka",
};

export default function OfflinePage() {
  return (
    <div className={styles.page}>
      <main className={styles.wrap}>
        <MascotIdle className={styles.mascot} />
        <div className={styles.offline}>
          <h1>Нет интернета</h1>
          <p>
            Uspeyka ждёт, когда связь вернётся. Как только появится сеть — откроем ваши дела.
          </p>
          <RetryButton />
        </div>
      </main>
    </div>
  );
}
