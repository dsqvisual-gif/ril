"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isDateKey } from "@/lib/validation";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";

export type GoalStepDTO = {
  id: string;
  title: string;
  done: boolean;
};

export type GoalEntryDTO = {
  id: string;
  text: string;
  createdAt: string;
};

export type GoalDTO = {
  id: string;
  title: string;
  why: string | null;
  deadline: string | null;
  doneAt: string | null;
  createdAt: string;
  steps: GoalStepDTO[];
  entries: GoalEntryDTO[];
};

export type CreateGoalInput = {
  title: string;
  why?: string | null;
  deadline?: string | null;
};

const GOAL_TITLE_MAX = 140;
const GOAL_WHY_MAX = 300;
const STEP_TITLE_MAX = 140;
const ENTRY_TEXT_MAX = 500;
const GOALS_MAX = 100;
const STEPS_MAX = 60;

const goalInclude = {
  steps: { orderBy: { createdAt: "asc" as const } },
  entries: { orderBy: { createdAt: "desc" as const } },
};

type GoalRecord = {
  id: string;
  title: string;
  why: string | null;
  deadline: string | null;
  doneAt: Date | null;
  createdAt: Date;
  steps: { id: string; title: string; done: boolean }[];
  entries: { id: string; text: string; createdAt: Date }[];
};

function toDTO(goal: GoalRecord): GoalDTO {
  return {
    id: goal.id,
    title: goal.title,
    why: goal.why,
    deadline: goal.deadline,
    doneAt: goal.doneAt ? goal.doneAt.toISOString() : null,
    createdAt: goal.createdAt.toISOString(),
    steps: goal.steps.map((step) => ({ id: step.id, title: step.title, done: step.done })),
    entries: goal.entries.map((entry) => ({
      id: entry.id,
      text: entry.text,
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

  const goal = await prisma.goal.create({
    data: { userId, title, why, deadline },
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

async function deleteStepInner(stepId: string): Promise<GoalDTO> {
  const userId = await requireUserId();
  const step = await ownStep(userId, stepId);
  await prisma.goalStep.delete({ where: { id: step.id } });
  return loadGoal(step.goalId);
}

async function addEntryInner(goalId: string, rawText: string): Promise<GoalDTO> {
  const userId = await requireUserId();
  const text = cleanText(rawText, ENTRY_TEXT_MAX, "Запись", true)!;
  await ownGoal(userId, goalId);
  await prisma.goalEntry.create({ data: { goalId, text } });
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

export async function deleteGoalStep(stepId: string): Promise<ActionResult<GoalDTO>> {
  return toResult(() => deleteStepInner(stepId));
}

export async function addGoalEntry(goalId: string, text: string): Promise<ActionResult<GoalDTO>> {
  return toResult(() => addEntryInner(goalId, text));
}

export async function deleteGoalEntry(entryId: string): Promise<ActionResult<GoalDTO>> {
  return toResult(() => deleteEntryInner(entryId));
}
