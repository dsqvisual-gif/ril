import { ACHIEVEMENTS } from "@/lib/achievements";
import styles from "./AchievementGrid.module.css";

type Props = {
  unlockedCodes: string[];
  completedCount: number;
};

export function AchievementGrid({ unlockedCodes, completedCount }: Props) {
  const unlocked = new Set(unlockedCodes);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Достижения</h1>
        <p className={styles.meta}>
          Выполнено дел: <strong>{completedCount}</strong>
        </p>
      </header>

      <div className={styles.grid}>
        {ACHIEVEMENTS.map((a) => {
          const isOpen = unlocked.has(a.code);
          const progress = Math.min(100, Math.round((completedCount / a.threshold) * 100));
          return (
            <article
              key={a.code}
              className={`${styles.card} ${isOpen ? styles.open : styles.locked}`}
            >
              <div className={styles.icon}>{isOpen ? "★" : "○"}</div>
              <h2>{a.title}</h2>
              <p>{a.description}</p>
              <div className={styles.bar}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <span className={styles.progress}>
                {Math.min(completedCount, a.threshold)} / {a.threshold}
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
