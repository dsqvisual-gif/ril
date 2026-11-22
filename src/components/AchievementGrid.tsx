import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ACHIEVEMENTS, CATEGORIES, STAT_LABELS, type StatKey, type Stats } from "@/lib/achievements";
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

      <MyNumbers stats={stats} />

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
                      <>
                        <span className={styles.date}>
                          Получено {format(new Date(at!), "d MMMM yyyy", { locale: ru })}
                        </span>
                        {stats[a.stat] > 0 ? (
                          <span className={styles.result}>
                            <b>{formatNumber(stats[a.stat])}</b> {STAT_LABELS[a.stat]}
                          </span>
                        ) : null}
                      </>
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

const NUMBERS: { stat: StatKey; icon: string; label: string; format?: (n: number) => string }[] = [
  { stat: "tasksDone", icon: "✅", label: "дел сделано" },
  { stat: "importantDone", icon: "⭐", label: "важных из них" },
  { stat: "bestDay", icon: "⚡", label: "рекорд дел за день" },
  { stat: "bestStreak", icon: "🔥", label: "дней — лучшая серия дел" },
  { stat: "useStreak", icon: "📅", label: "дней подряд заходишь" },
  { stat: "activeDays", icon: "☕", label: "дней в Uspeyka" },
  { stat: "daysWithUs", icon: "🎂", label: "дней с нами" },
  { stat: "minutesInApp", icon: "⏱️", label: "в приложении", format: formatMinutes },
  { stat: "goalsDone", icon: "🌈", label: "целей достигнуто" },
  { stat: "sharedDone", icon: "👯", label: "совместных дел" },
];

/** The person's own totals: they keep growing after every achievement is earned. */
function MyNumbers({ stats }: { stats: Stats }) {
  return (
    <section className={styles.numbers} aria-label="Мои цифры">
      <h2 className={styles.nextTitle}>Мои цифры</h2>
      <div className={styles.numberGrid}>
        {NUMBERS.map((n) => (
          <div key={n.stat} className={styles.numberTile}>
            <span className={styles.numberIcon} aria-hidden>
              {n.icon}
            </span>
            <b className={styles.numberValue}>
              {n.format ? n.format(stats[n.stat]) : formatNumber(stats[n.stat])}
            </b>
            <span className={styles.numberLabel}>{n.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString("ru-RU");
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  return hours < 100 ? `${hours} ч ${minutes % 60} мин` : `${formatNumber(hours)} ч`;
}
