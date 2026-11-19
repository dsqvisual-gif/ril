export const ACHIEVEMENT_THRESHOLDS = [10, 50, 100, 250, 500, 1000] as const;

export type AchievementCode = `tasks_${(typeof ACHIEVEMENT_THRESHOLDS)[number]}`;

export type AchievementDef = {
  code: AchievementCode;
  threshold: number;
  title: string;
  description: string;
};

export const ACHIEVEMENTS: AchievementDef[] = ACHIEVEMENT_THRESHOLDS.map(
  (threshold) => ({
    code: `tasks_${threshold}` as AchievementCode,
    threshold,
    title: `${threshold} дел`,
    description: `Выполните ${threshold} задач`,
  }),
);

export function codeForThreshold(n: number): AchievementCode {
  return `tasks_${n}` as AchievementCode;
}
