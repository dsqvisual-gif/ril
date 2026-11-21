import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { redirect } from "next/navigation";
import { addDays, startOfWeek, isSameDay } from "date-fns";
import { auth } from "@/lib/auth";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Uspeyka — планер для продуктивной жизни",
  description:
    "Удобный планер на день, неделю и месяц: дела, достижения, совместные задачи с друзьями и голосовой ввод.",
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const FEATURES = [
  {
    title: "Планирование",
    text: "День, неделя и месяц",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3.5" y="5" width="17" height="15" rx="3" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    title: "Достижения",
    text: "Награды за прогресс",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
      </svg>
    ),
  },
  {
    title: "Вместе с друзьями",
    text: "Общие дела и планы",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="9" cy="8.5" r="3.2" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <circle cx="16.5" cy="9.5" r="2.6" />
        <path d="M15.5 14.3A4.6 4.6 0 0 1 20.5 19" />
      </svg>
    ),
  },
  {
    title: "Голосовой ввод",
    text: "Скажи — и дело записано",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
      </svg>
    ),
  },
];

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/app");
  }

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const week = WEEKDAYS.map((label, i) => {
    const date = addDays(weekStart, i);
    return { label, day: date.getDate(), isToday: isSameDay(date, today) };
  });

  return (
    <div className={styles.page}>
      <div className={styles.blobLeft} aria-hidden />
      <div className={styles.blobRight} aria-hidden />

      <header className={styles.header}>
        <Brand href="/" />
        <div className={styles.headerActions}>
          <Link href="/login" className={styles.btnLight}>
            Войти
          </Link>
          <Link href="/register" className={`${styles.btnPrimary} ${styles.hideMobile}`}>
            Начать бесплатно
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <span className={styles.badge}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5L13.5 2Z" />
              </svg>
              Планер для продуктивной жизни
            </span>
            <h1 className={styles.headline}>
              Планируй, успевай, живи в&nbsp;своём темпе
            </h1>
            <p className={styles.lead}>
              Удобный планер, который помогает наводить порядок в делах,
              достигать целей и сохранять баланс.
            </p>
            <div className={styles.cta}>
              <Link href="/register" className={`${styles.btnPrimary} ${styles.btnLarge}`}>
                Начать бесплатно
                <svg viewBox="0 0 24 24" aria-hidden className={styles.arrow}>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>

          <div className={styles.visual} aria-hidden>
            <div className={styles.podium} />
            <Image
              src="/mascot.webp"
              alt=""
              width={640}
              height={1028}
              priority
              className={styles.mascot}
              sizes="(max-width: 900px) 60vw, 340px"
            />

            <span className={`${styles.spark} ${styles.sparkTop}`}>
              <i />
              <i />
              <i />
            </span>
            <span className={`${styles.spark} ${styles.sparkLeft}`}>
              <i />
              <i />
            </span>

            <div className={`${styles.card} ${styles.cardTasks}`}>
              <p className={styles.cardTitle}>
                <svg viewBox="0 0 24 24" className={styles.bolt}>
                  <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5L13.5 2Z" />
                </svg>
                Мои задачи
              </p>
              <ul className={styles.tasks}>
                <li className={styles.taskDone}>
                  <i />
                  Подготовить презентацию
                </li>
                <li>
                  <i />
                  Тренировка
                </li>
                <li>
                  <i />
                  Прочитать 20 страниц
                </li>
              </ul>
            </div>

            <div className={`${styles.card} ${styles.cardCalendar}`}>
              <p className={styles.cardTitle}>Сегодня</p>
              <div className={styles.week}>
                {week.map((d) => (
                  <div key={d.label} className={styles.weekDay}>
                    <span>{d.label}</span>
                    <b className={d.isToday ? styles.today : undefined}>{d.day}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${styles.card} ${styles.cardGoal}`}>
              <p className={styles.cardTitle}>
                <svg viewBox="0 0 24 24" className={styles.target}>
                  <circle cx="12" cy="12" r="8.5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="12" cy="12" r="1" />
                </svg>
                Цели
              </p>
              <p className={styles.goalName}>Прочитать 5 книг</p>
              <div className={styles.progress}>
                <span style={{ width: "60%" }} />
              </div>
              <span className={styles.goalPct}>60%</span>
            </div>
          </div>
        </section>

        <section id="features" className={styles.features}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.feature}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </div>
          ))}
        </section>

      </main>

      <footer className={styles.footer}>
        <span>© {today.getFullYear()} Uspeyka</span>
        <nav className={styles.footerLinks} aria-label="Документы">
          <Link href="/privacy">Политика конфиденциальности</Link>
          <Link href="/security">Безопасность</Link>
        </nav>
      </footer>
    </div>
  );
}
