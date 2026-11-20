import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ACHIEVEMENTS, CATEGORIES, type Stats } from "@/lib/achievements";
import styles from "./AchievementGrid.module.css";

type Props = {
  stats: Stats;
  unlocked: { code: string; at: string }[];
};

export function AchievementGrid({ stats, unlocked }: Props) {
  const unlockedAt = new Map(unlocked.map((u) => [u.code, u.at]));
  const openCount = ACHIEVEMENTS.filter((a) => unlockedAt.has(a.code)).length;
  const percent = Math.round((openCount / ACHIEVEMENTS.length) * 100);

  // Closest locked, non-secret achievements: what to aim for next.
  const next = ACHIEVEMENTS.filter((a) => !unlockedAt.has(a.code) && !a.secret)
    .map((a) => ({ a, ratio: Math.min(1, stats[a.stat] / a.target) }))
    .sort((x, y) => y.ratio - x.ratio)
    .slice(0, 3);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Достижения</h1>
        <p className={styles.meta}>
          Открыто <strong>{openCount}</strong> из {ACHIEVEMENTS.length} · выполнено дел:{" "}
          <strong>{stats.tasksDone}</strong>
        </p>
        <div className={styles.total} aria-hidden>
          <span style={{ width: `${percent}%` }} />
        </div>
      </header>

      {next.length > 0 ? (
        <section className={styles.next}>
          <h2 className={styles.nextTitle}>Ближе всего</h2>
          <div className={styles.nextList}>
            {next.map(({ a, ratio }) => (
              <div key={a.code} className={styles.nextItem}>
                <span className={styles.nextIcon}>{a.icon}</span>
                <div className={styles.nextBody}>
                  <p className={styles.nextName}>{a.title}</p>
                  <p className={styles.nextDesc}>{a.description}</p>
                  <div className={styles.bar}>
                    <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                </div>
                <span className={styles.nextCount}>
                  {Math.min(stats[a.stat], a.target)}/{a.target}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {CATEGORIES.map((category) => {
        const items = ACHIEVEMENTS.filter((a) => a.category === category.id);
        const open = items.filter((a) => unlockedAt.has(a.code)).length;
        return (
          <section key={category.id} className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>{category.title}</h2>
              <span>
                {open} / {items.length}
              </span>
            </div>
            <p className={styles.sectionLead}>{category.lead}</p>
            <div className={styles.grid}>
              {items.map((a) => {
                const at = unlockedAt.get(a.code);
                const isOpen = Boolean(at);
                const hidden = a.secret && !isOpen;
                const value = Math.min(stats[a.stat], a.target);
                const progress = Math.round((value / a.target) * 100);
                return (
                  <article
                    key={a.code}
                    className={`${styles.card} ${isOpen ? styles.open : styles.locked} ${hidden ? styles.secret : ""}`}
                  >
                    <div className={styles.icon}>{hidden ? "?" : a.icon}</div>
                    <h3>{hidden ? "Секретное достижение" : a.title}</h3>
                    <p>{hidden ? "Откроется, когда ты сделаешь что-то особенное" : a.description}</p>
                    {isOpen ? (
                      <span className={styles.date}>
                        Получено {format(new Date(at!), "d MMMM yyyy", { locale: ru })}
                      </span>
                    ) : hidden ? null : (
                      <>
                        <div className={styles.bar}>
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <span className={styles.progress}>
                          {value} / {a.target}
                        </span>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
