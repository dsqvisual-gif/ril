"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isDateKey } from "@/lib/validation";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import { isGoalKind, type GoalKind } from "@/lib/goal-progress";

export type GoalStepDTO = {
  id: string;
  title: string;
  done: boolean;
};

export type GoalEntryDTO = {
  id: string;
  text: string;
  amount: number | null;
  progress: number | null;
  createdAt: string;
};

export type GoalDTO = {
  id: string;
  title: string;
  why: string | null;
  deadline: string | null;
  kind: GoalKind;
  target: number | null;
  unit: string | null;
  selfProgress: number | null;
  doneAt: string | null;
  createdAt: string;
  steps: GoalStepDTO[];
  entries: GoalEntryDTO[];
};

export type GoalMeasureInput = {
  kind: GoalKind;
  target?: number | null;
  unit?: string | null;
};

export type CreateGoalInput = {
  title: string;
  why?: string | null;
  deadline?: string | null;
} & Partial<GoalMeasureInput>;

export type GoalEntryInput = {
  text: string;
  amount?: number | null;
  progress?: number | null;
};

const GOAL_TITLE_MAX = 140;
const GOAL_WHY_MAX = 300;
const STEP_TITLE_MAX = 140;
const ENTRY_TEXT_MAX = 500;
const GOALS_MAX = 100;
const STEPS_MAX = 60;
const UNIT_MAX = 20;
const TARGET_MAX = 1_000_000_000;

const goalInclude = {
  steps: { orderBy: { createdAt: "asc" as const } },
  entries: { orderBy: { createdAt: "desc" as const } },
};

type GoalRecord = {
  id: string;
  title: string;
  why: string | null;
  deadline: string | null;
  kind: string;
  target: number | null;
  unit: string | null;
  selfProgress: number | null;
  doneAt: Date | null;
  createdAt: Date;
  steps: { id: string; title: string; done: boolean }[];
  entries: {
    id: string;
    text: string;
    amount: number | null;
    progress: number | null;
    createdAt: Date;
  }[];
};

function toDTO(goal: GoalRecord): GoalDTO {
  return {
    id: goal.id,
    title: goal.title,
    why: goal.why,
    deadline: goal.deadline,
    kind: isGoalKind(goal.kind) ? goal.kind : "steps",
    target: goal.target,
    unit: goal.unit,
    selfProgress: goal.selfProgress,
    doneAt: goal.doneAt ? goal.doneAt.toISOString() : null,
    createdAt: goal.createdAt.toISOString(),
    steps: goal.steps.map((step) => ({ id: step.id, title: step.title, done: step.done })),
    entries: goal.entries.map((entry) => ({
      id: entry.id,
      text: entry.text,
      amount: entry.amount,
      progress: entry.progress,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

function cleanText(raw: unknown, max: number, label: string, required: boolean): string | null {
  const text = typeof raw === "string" ? raw.trim().replace(/\s+\n/g, "\n") : "";
  if (!text) {
    if (required) throw new UserError(`${label}: напишите хоть пару слов`);
    return null;
  }
  if (text.length > max) throw new UserError(`${label}: не длиннее ${max} символов`);
  return text;
}

function parseMeasure(input: Partial<GoalMeasureInput>): {
  kind: GoalKind;
  target: number | null;
  unit: string | null;
} {
  const kind = input.kind ?? "steps";
  if (!isGoalKind(kind)) throw new UserError("Неизвестный способ измерения");
  if (kind !== "number") return { kind, target: null, unit: null };
  const target = Number(input.target);
  if (!Number.isFinite(target) || target <= 0 || target > TARGET_MAX) {
    throw new UserError("Укажите, сколько нужно — число больше нуля");
  }
  const unit = cleanText(input.unit, UNIT_MAX, "Единица", false);
  return { kind, target, unit };
}

async function ownGoal(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  if (!goal) throw new UserError("Цель не найдена");
  return goal;
}

async function loadGoal(goalId: string): Promise<GoalDTO> {
  const goal = await prisma.goal.findUniqueOrThrow({
    where: { id: goalId },
    include: goalInclude,
  });
  return toDTO(goal);
}

export async function listGoals(): Promise<GoalDTO[]> {
  const userId = await requireUserId();
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: goalInclude,
    orderBy: { createdAt: "desc" },
  });
  return goals.map(toDTO);
}

async function createGoalInner(input: CreateGoalInput): Promise<GoalDTO> {
  const userId = await requireUserId();
  const title = cleanText(input.title, GOAL_TITLE_MAX, "Цель", true)!;
  const why = cleanText(input.why, GOAL_WHY_MAX, "Зачем", false);
  const deadline = input.deadline?.trim() || null;
  if (deadline && !isDateKey(deadline)) throw new UserError("Некорректная дата");

  const count = await prisma.goal.count({ where: { userId } });
  if (count >= GOALS_MAX) throw new UserError(`Можно держать до ${GOALS_MAX} целей`);

  const measure = parseMeasure(input);
  const goal = await prisma.goal.create({
    data: { userId, title, why, deadline, ...measure },
    include: goalInclude,
  });
  return toDTO(goal);
}

async function setGoalDoneInner(goalId: string, done: boolean): Promise<GoalDTO> {
  const userId = await requireUserId();
  await ownGoal(userId, goalId);
  await prisma.goal.update({
    where: { id: goalId },
    data: { doneAt: done ? new Date() : null },
  });
  return loadGoal(goalId);
}

async function deleteGoalInner(goalId: string): Promise<void> {
  const userId = await requireUserId();
  await ownGoal(userId, goalId);
  await prisma.goal.delete({ where: { id: goalId } });
}

async function addStepInner(goalId: string, rawTitle: string): Promise<GoalDTO> {
  const userId = await requireUserId();
  const title = cleanText(rawTitle, STEP_TITLE_MAX, "Шаг", true)!;
  await ownGoal(userId, goalId);
  const count = await prisma.goalStep.count({ where: { goalId } });
  if (count >= STEPS_MAX) throw new UserError(`В цели может быть до ${STEPS_MAX} шагов`);
  await prisma.goalStep.create({ data: { goalId, title } });
  return loadGoal(goalId);
}

async function ownStep(userId: string, stepId: string) {
  const step = await prisma.goalStep.findFirst({
    where: { id: stepId, goal: { userId } },
    select: { id: true, goalId: true, done: true },
  });
  if (!step) throw new UserError("Шаг не найден");
  return step;
}

async function toggleStepInner(stepId: string): Promise<GoalDTO> {
  const userId = await requireUserId();
  const step = await ownStep(userId, stepId);
  const done = !step.done;
  await prisma.goalStep.update({
    where: { id: step.id },
    data: { done, doneAt: done ? new Date() : null },
  });
  return loadGoal(step.goalId);
}

async function renameStepInner(stepId: string, rawTitle: string): Promise<GoalDTO> {
  const userId = await requireUserId();
  const title = cleanText(rawTitle, STEP_TITLE_MAX, "Шаг", true)!;
  const step = await ownStep(userId, stepId);
  await prisma.goalStep.update({ where: { id: step.id }, data: { title } });
  return loadGoal(step.goalId);
}

async function deleteStepInner(stepId: string): Promise<GoalDTO> {
  const userId = await requireUserId();
  const step = await ownStep(userId, stepId);
  await prisma.goalStep.delete({ where: { id: step.id } });
  return loadGoal(step.goalId);
}

async function addEntryInner(goalId: string, input: GoalEntryInput): Promise<GoalDTO> {
  const userId = await requireUserId();
  const text = cleanText(input.text, ENTRY_TEXT_MAX, "Запись", true)!;
  await ownGoal(userId, goalId);
  const goal = await prisma.goal.findUniqueOrThrow({
    where: { id: goalId },
    select: { kind: true },
  });

  let amount: number | null = null;
  let progress: number | null = null;
  if (goal.kind === "number" && input.amount !== undefined && input.amount !== null) {
    amount = Number(input.amount);
    if (!Number.isFinite(amount) || Math.abs(amount) > TARGET_MAX) {
      throw new UserError("Некорректное число");
    }
  }
  if (goal.kind === "feeling" && input.progress !== undefined && input.progress !== null) {
    progress = Math.round(Number(input.progress));
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      throw new UserError("Оценка — от 0 до 100%");
    }
  }

  await prisma.$transaction([
    prisma.goalEntry.create({ data: { goalId, text, amount, progress } }),
    ...(progress !== null
      ? [prisma.goal.update({ where: { id: goalId }, data: { selfProgress: progress } })]
      : []),
  ]);
  return loadGoal(goalId);
}

async function setMeasureInner(goalId: string, input: GoalMeasureInput): Promise<GoalDTO> {
  const userId = await requireUserId();
  await ownGoal(userId, goalId);
  const measure = parseMeasure(input);
  await prisma.goal.update({ where: { id: goalId }, data: measure });
  return loadGoal(goalId);
}

async function setSelfProgressInner(goalId: string, raw: number): Promise<GoalDTO> {
  const userId = await requireUserId();
  await ownGoal(userId, goalId);
  const progress = Math.round(Number(raw));
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new UserError("Оценка — от 0 до 100%");
  }
  await prisma.goal.update({ where: { id: goalId }, data: { selfProgress: progress } });
  return loadGoal(goalId);
}

async function deleteEntryInner(entryId: string): Promise<GoalDTO> {
  const userId = await requireUserId();
  const entry = await prisma.goalEntry.findFirst({
    where: { id: entryId, goal: { userId } },
    select: { id: true, goalId: true },
  });
  if (!entry) throw new UserError("Запись не найдена");
  await prisma.goalEntry.delete({ where: { id: entry.id } });
  return loadGoal(entry.goalId);
}

export async function createGoal(input: CreateGoalInput): Promise<ActionResult<GoalDTO>> {
  return toResult(() => createGoalInner(input));
}

export async function setGoalDone(goalId: string, done: boolean): Promise<ActionResult<GoalDTO>> {
  return toResult(() => setGoalDoneInner(goalId, done));
}

export async function deleteGoal(goalId: string): Promise<ActionResult<void>> {
  return toResult(() => deleteGoalInner(goalId));
}

export async function addGoalStep(goalId: string, title: string): Promise<ActionResult<GoalDTO>> {
  return toResult(() => addStepInner(goalId, title));
}

export async function toggleGoalStep(stepId: string): Promise<ActionResult<GoalDTO>> {
  return toResult(() => toggleStepInner(stepId));
}

export async function renameGoalStep(stepId: string, title: string): Promise<ActionResult<GoalDTO>> {
  return toResult(() => renameStepInner(stepId, title));
}

export async function deleteGoalStep(stepId: string): Promise<ActionResult<GoalDTO>> {
  return toResult(() => deleteStepInner(stepId));
}

export async function addGoalEntry(
  goalId: string,
  input: GoalEntryInput,
): Promise<ActionResult<GoalDTO>> {
  return toResult(() => addEntryInner(goalId, input));
}

export async function setGoalMeasure(
  goalId: string,
  input: GoalMeasureInput,
): Promise<ActionResult<GoalDTO>> {
  return toResult(() => setMeasureInner(goalId, input));
}

export async function setGoalSelfProgress(
  goalId: string,
  progress: number,
): Promise<ActionResult<GoalDTO>> {
  return toResult(() => setSelfProgressInner(goalId, progress));
}

export async function deleteGoalEntry(entryId: string): Promise<ActionResult<GoalDTO>> {
  return toResult(() => deleteEntryInner(entryId));
}
