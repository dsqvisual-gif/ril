import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import styles from "./page.module.css";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/app");
  }

  return (
    <main className={styles.hero}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.brand}>
        <Brand href="/" large />
      </div>
      <h1 className={styles.headline}>Планер, который не мешает жить</h1>
      <p className={styles.lead}>
        День, неделя и месяц в одном спокойном интерфейсе. Отмечайте дела,
        ставьте время по желанию — и копите достижения.
      </p>
      <div className={styles.cta}>
        <Link href="/register" className="btn btn-primary">
          Начать
        </Link>
        <Link href="/login" className="btn btn-ghost">
          Войти
        </Link>
      </div>
      <div className={styles.preview} aria-hidden>
        <div className={styles.previewCard}>
          <span>Сегодня</span>
          <div className={styles.fakeTask}>
            <i /> Утренняя пробежка <em>07:30</em>
          </div>
          <div className={`${styles.fakeTask} ${styles.done}`}>
            <i /> Ответить на письма
          </div>
          <div className={styles.fakeTask}>
            <i /> Проект: ревью дизайна <em>16:00</em>
          </div>
        </div>
      </div>
    </main>
  );
}
