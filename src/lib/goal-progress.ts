export type GoalKind = "steps" | "number" | "feeling";

export const GOAL_KINDS: { id: GoalKind; label: string; hint: string }[] = [
  {
    id: "steps",
    label: "Шагами",
    hint: "Разбиваешь цель на шаги, прогресс — доля выполненных шагов.",
  },
  {
    id: "number",
    label: "Числом",
    hint: "Есть что посчитать: 5 книг, 10 км, 300 слов. В записях отмечаешь, сколько добавилось.",
  },
  {
    id: "feeling",
    label: "По ощущениям",
    hint: "Цель не измерить цифрой (стать спокойнее, наладить режим). Сам оцениваешь, насколько ближе.",
  },
];

export function isGoalKind(value: unknown): value is GoalKind {
  return value === "steps" || value === "number" || value === "feeling";
}

type ProgressInput = {
  kind: string;
  target: number | null;
  unit: string | null;
  selfProgress: number | null;
  steps: { done: boolean }[];
  entries: { amount: number | null }[];
};

/** Share of the goal reached (0–1, or null when it cannot be told yet) and a short label. */
export function goalProgress(goal: ProgressInput): { ratio: number | null; label: string } {
  if (goal.kind === "number") {
    const sum = goal.entries.reduce((total, e) => total + (e.amount ?? 0), 0);
    if (!goal.target || goal.target <= 0) return { ratio: null, label: "укажи, сколько нужно" };
    return {
      ratio: Math.min(1, sum / goal.target),
      label: `${formatAmount(sum)} из ${formatAmount(goal.target)}${goal.unit ? ` ${goal.unit}` : ""}`,
    };
  }
  if (goal.kind === "feeling") {
    if (goal.selfProgress === null) return { ratio: null, label: "оцени, насколько ты ближе" };
    return { ratio: goal.selfProgress / 100, label: "по твоей оценке" };
  }
  const total = goal.steps.length;
  if (total === 0) return { ratio: null, label: "шагов пока нет" };
  const done = goal.steps.filter((s) => s.done).length;
  return { ratio: done / total, label: `${done} из ${total} ${pluralSteps(total)}` };
}

export function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

function pluralSteps(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "шага";
  return "шагов";
}

const ADJECTIVE_END = /(ых|их|ые|ие)$/;

/**
 * Reads a countable target from a goal title: «Прочитать 5 книг» → 5 книг,
 * «Выучить 300 английских слов» → 300 английских слов. Null when there is no number.
 */
export function guessTarget(title: string): { target: number; unit: string } | null {
  const match = title.match(/(\d+(?:[.,]\d+)?)\s*([^\d\s.,!?;:()«»"]+)?(?:\s+([^\d\s.,!?;:()«»"]+))?/u);
  if (!match) return null;
  const target = Number(match[1].replace(",", "."));
  if (!Number.isFinite(target) || target <= 0) return null;
  const first = match[2]?.toLowerCase() ?? "";
  const second = match[3]?.toLowerCase() ?? "";
  const unit = (ADJECTIVE_END.test(first) && second ? `${first} ${second}` : first).slice(0, 20);
  return { target, unit };
}
