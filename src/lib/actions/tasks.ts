"use server";

import { prisma } from "@/lib/prisma";
import { isLingering, resolveToday } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { isDateKey, isTimeKey, TASK_TITLE_MAX } from "@/lib/validation";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import {
  ACHIEVEMENT_THRESHOLDS,
  codeForThreshold,
  type AchievementCode,
} from "@/lib/achievements";

export type PersonDTO = {
  id: string;
  name: string;
  username: string;
};

export type TaskDTO = {
  id: string;
  title: string;
  date: string;
  originDate: string;
  keptOn: string | null;
  time: string | null;
  important: boolean;
  urgent: boolean;
  done: boolean;
  shared: boolean;
  viewerIsOwner: boolean;
  ownerUsername: string | null;
  ownerName: string | null;
  partners: PersonDTO[];
};

export type ArchivedTask = {
  id: string;
  title: string;
  date: string;
  originDate: string;
  important: boolean;
  urgent: boolean;
  viewerIsOwner: boolean;
  archivedAt: string | null;
};

export type CreateTaskInput = {
  title: string;
  date: string;
  time?: string | null;
  important?: boolean;
  urgent?: boolean;
  friendIds?: string[];
};

export type ToggleResult = {
  task: TaskDTO;
  newlyUnlocked: AchievementCode[];
};

function includeFor(userId: string) {
  return {
    user: { select: { id: true, name: true, username: true } },
    shares: {
      select: {
        user: { select: { id: true, name: true, username: true } },
      },
    },
    viewerStates: {
      where: { userId },
      select: { keptOn: true, archived: true, archivedAt: true },
    },
  };
}

type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  date: string;
  originDate: string | null;
  time: string | null;
  important: boolean;
  urgent: boolean;
  done: boolean;
  user: { id: string; name: string; username: string | null };
  shares: { user: { id: string; name: string; username: string | null } }[];
  viewerStates: { keptOn: string | null; archived: boolean; archivedAt: Date | null }[];
};

function personFrom(user: {
  id: string;
  name: string;
  username: string | null;
}): PersonDTO | null {
  if (!user.username) return null;
  return { id: user.id, name: user.name, username: user.username };
}

function named(person: PersonDTO, aliases: Map<string, string>): PersonDTO {
  const alias = aliases.get(person.id);
  return alias ? { ...person, name: alias } : person;
}

function toDTO(task: TaskRecord, viewerId: string, aliases: Map<string, string>): TaskDTO {
  const partners: PersonDTO[] = [];
  const owner = personFrom(task.user);
  if (owner && owner.id !== viewerId) partners.push(named(owner, aliases));
  for (const share of task.shares) {
    const person = personFrom(share.user);
    if (person && person.id !== viewerId) partners.push(named(person, aliases));
  }

  const ownerAlias = aliases.get(task.user.id);

  return {
    id: task.id,
    title: task.title,
    date: task.date,
    originDate: task.originDate || task.date,
    keptOn: task.viewerStates[0]?.keptOn ?? null,
    time: task.time,
    important: task.important,
    urgent: task.urgent,
    done: task.done,
    shared: task.shares.length > 0,
    viewerIsOwner: task.userId === viewerId,
    ownerUsername: task.user.username,
    ownerName: task.userId === viewerId ? null : ownerAlias || task.user.name,
    partners,
  };
}

async function aliasMap(userId: string, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => id && id !== userId))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [
        { requesterId: userId, addresseeId: { in: unique } },
        { addresseeId: userId, requesterId: { in: unique } },
      ],
    },
    select: {
      requesterId: true,
      addresseeId: true,
      requesterAlias: true,
      addresseeAlias: true,
    },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    const friendId = row.requesterId === userId ? row.addresseeId : row.requesterId;
    const alias = (row.requesterId === userId ? row.requesterAlias : row.addresseeAlias)?.trim();
    if (alias) map.set(friendId, alias);
  }
  return map;
}

function peopleIds(tasks: TaskRecord[], viewerId: string): string[] {
  const ids: string[] = [];
  for (const task of tasks) {
    if (task.userId !== viewerId) ids.push(task.userId);
    for (const share of task.shares) ids.push(share.user.id);
  }
  return ids;
}

async function present(tasks: TaskRecord[], viewerId: string): Promise<TaskDTO[]> {
  const aliases = await aliasMap(viewerId, peopleIds(tasks, viewerId));
  return tasks.map((task) => toDTO(task, viewerId, aliases));
}

function accessWhere(userId: string) {
  return {
    OR: [{ userId }, { shares: { some: { userId } } }],
  };
}

function openWhere(userId: string) {
  return {
    AND: [
      accessWhere(userId),
      { NOT: { viewerStates: { some: { userId, archived: true } } } },
    ],
  };
}

function completedWhere(userId: string) {
  return {
    done: true,
    ...accessWhere(userId),
  };
}

async function syncAchievements(
  userId: string,
): Promise<{ newlyUnlocked: AchievementCode[]; completedCount: number }> {
  const [completedCount, existing] = await Promise.all([
    prisma.task.count({ where: completedWhere(userId) }),
    prisma.achievementUnlock.findMany({ where: { userId }, select: { code: true } }),
  ]);
  const existingSet = new Set(existing.map((a) => a.code));

  const newlyUnlocked = ACHIEVEMENT_THRESHOLDS.filter((threshold) => completedCount >= threshold)
    .map(codeForThreshold)
    .filter((code) => !existingSet.has(code));

  if (newlyUnlocked.length > 0) {
    // skipDuplicates: two quick toggles may race to unlock the same achievement.
    await prisma.achievementUnlock.createMany({
      data: newlyUnlocked.map((code) => ({ userId, code })),
      skipDuplicates: true,
    });
  }

  return { newlyUnlocked, completedCount };
}

export async function completedTaskCount(): Promise<number> {
  const userId = await requireUserId();
  return prisma.task.count({ where: completedWhere(userId) });
}

export async function queryTasks(from: string, to: string): Promise<TaskDTO[]> {
  const userId = await requireUserId();
  const tasks = await prisma.task.findMany({
    where: {
      AND: [{ date: { gte: from, lte: to } }, openWhere(userId)],
    },
    include: includeFor(userId),
    orderBy: [{ urgent: "desc" }, { important: "desc" }, { time: "asc" }, { createdAt: "asc" }],
  });
  return present(tasks, userId);
}

export type SettleResult = {
  /** Open tasks lingering for two or more days, to ask the user about. */
  prompts: TaskDTO[];
  /** Whether overdue tasks were moved to today. */
  moved: boolean;
};

export async function settleOpenTasks(rawToday: string): Promise<SettleResult> {
  const userId = await requireUserId();
  const today = resolveToday(rawToday);

  const overdue = await prisma.task.findMany({
    where: {
      done: false,
      date: { lt: today },
      ...accessWhere(userId),
    },
    select: { id: true },
  });
  if (overdue.length > 0) {
    const ids = overdue.map((task) => task.id);
    await prisma.$executeRaw`
      UPDATE "Task"
      SET "originDate" = COALESCE("originDate", "date"), "date" = ${today}
      WHERE "id" = ANY(${ids})`;
  }

  const tasks = await prisma.task.findMany({
    where: {
      done: false,
      date: { lte: today },
      ...openWhere(userId),
    },
    include: includeFor(userId),
    orderBy: [{ urgent: "desc" }, { important: "desc" }, { createdAt: "asc" }],
  });
  const lingering = tasks.filter((task) =>
    isLingering(task.originDate || task.date, task.viewerStates[0]?.keptOn ?? null, today),
  );
  return { prompts: await present(lingering, userId), moved: overdue.length > 0 };
}

async function touchViewer(
  userId: string,
  taskId: string,
  data: { keptOn?: string | null; archived: boolean; archivedAt: Date | null },
) {
  await prisma.taskViewerState.upsert({
    where: { userId_taskId: { userId, taskId } },
    create: { userId, taskId, ...data },
    update: data,
  });
}

async function keepTaskInner(taskId: string, rawToday: string): Promise<void> {
  const userId = await requireUserId();
  const today = resolveToday(rawToday);
  const task = await prisma.task.findFirst({
    where: { id: taskId, done: false, ...accessWhere(userId) },
    select: { id: true },
  });
  if (!task) throw new UserError("Задача не найдена");
  await touchViewer(userId, task.id, { keptOn: today, archived: false, archivedAt: null });
}

async function archiveTaskInner(taskId: string): Promise<void> {
  const userId = await requireUserId();
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...accessWhere(userId) },
    select: { id: true },
  });
  if (!task) throw new UserError("Задача не найдена");
  await touchViewer(userId, task.id, { archived: true, archivedAt: new Date() });
}

async function restoreTaskInner(taskId: string, rawToday: string): Promise<void> {
  const userId = await requireUserId();
  const today = resolveToday(rawToday);
  const [state, task] = await Promise.all([
    prisma.taskViewerState.findUnique({ where: { userId_taskId: { userId, taskId } } }),
    prisma.task.findFirst({ where: { id: taskId, ...accessWhere(userId) } }),
  ]);
  if (!state?.archived) throw new UserError("В архиве нет этой задачи");
  if (!task) throw new UserError("Задача больше недоступна");

  await prisma.taskViewerState.update({
    where: { id: state.id },
    data: { archived: false, archivedAt: null, keptOn: today },
  });
  if (!task.done && task.date < today) {
    await prisma.task.update({
      where: { id: task.id },
      data: { date: today, originDate: task.originDate ?? task.date },
    });
  }
}

export async function listArchivedTasks(): Promise<ArchivedTask[]> {
  const userId = await requireUserId();
  const rows = await prisma.taskViewerState.findMany({
    where: { userId, archived: true },
    orderBy: { archivedAt: "desc" },
    include: {
      task: {
        select: {
          id: true,
          userId: true,
          title: true,
          date: true,
          originDate: true,
          important: true,
          urgent: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.task.id,
    title: row.task.title,
    date: row.task.date,
    originDate: row.task.originDate || row.task.date,
    important: row.task.important,
    urgent: row.task.urgent,
    viewerIsOwner: row.task.userId === userId,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  }));
}

async function acceptedFriendIds(userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [
        { requesterId: userId, addresseeId: { in: ids } },
        { addresseeId: userId, requesterId: { in: ids } },
      ],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const allowed = new Set<string>();
  for (const row of rows) {
    allowed.add(row.requesterId === userId ? row.addresseeId : row.requesterId);
  }
  return allowed;
}

async function createTaskInner(input: CreateTaskInput): Promise<TaskDTO> {
  const userId = await requireUserId();
  const title = input.title.trim();
  if (!title) {
    throw new UserError("Название обязательно");
  }
  if (title.length > TASK_TITLE_MAX) {
    throw new UserError(`Название длиннее ${TASK_TITLE_MAX} символов`);
  }
  if (!isDateKey(input.date)) {
    throw new UserError("Некорректная дата");
  }

  let time: string | null = null;
  if (input.time && input.time.trim()) {
    const t = input.time.trim();
    if (!isTimeKey(t)) {
      throw new UserError("Некорректное время");
    }
    time = t;
  }

  const friendIds = [...new Set((input.friendIds ?? []).filter((id) => id && id !== userId))];
  const allowed = await acceptedFriendIds(userId, friendIds);
  if (friendIds.some((id) => !allowed.has(id))) {
    throw new UserError("Совместное дело можно добавить только с друзьями");
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title,
      date: input.date,
      originDate: input.date,
      time,
      important: Boolean(input.important),
      urgent: Boolean(input.urgent),
      shares: {
        create: friendIds.map((friendId) => ({ userId: friendId })),
      },
    },
    include: includeFor(userId),
  });

  const [dto] = await present([task], userId);
  return dto;
}

async function toggleTaskInner(taskId: string): Promise<ToggleResult> {
  const userId = await requireUserId();
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...openWhere(userId) },
    select: { id: true, userId: true, done: true, shares: { select: { userId: true } } },
  });
  if (!task) {
    throw new UserError("Задача не найдена");
  }

  const done = !task.done;
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      done,
      doneAt: done ? new Date() : null,
    },
    include: includeFor(userId),
  });

  // Completing can unlock achievements for everyone on the task;
  // undoing never revokes them, so there is nothing to sync then.
  const involved = done ? [task.userId, ...task.shares.map((share) => share.userId)] : [];
  const [[dto], synced] = await Promise.all([
    present([updated], userId),
    Promise.all(involved.map(syncAchievements)),
  ]);

  return {
    task: dto,
    newlyUnlocked: synced[involved.indexOf(userId)]?.newlyUnlocked ?? [],
  };
}

async function removeTaskInner(taskId: string): Promise<void> {
  const userId = await requireUserId();
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...accessWhere(userId) },
    select: { id: true, userId: true },
  });
  if (!task) throw new UserError("Задача не найдена");
  if (task.userId === userId) {
    await deleteTaskInner(taskId);
    return;
  }
  await prisma.$transaction([
    prisma.taskShare.deleteMany({ where: { taskId: task.id, userId } }),
    prisma.taskViewerState.deleteMany({ where: { taskId: task.id, userId } }),
  ]);
}

async function deleteTaskInner(taskId: string): Promise<void> {
  const userId = await requireUserId();
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...accessWhere(userId) },
    select: { id: true, userId: true },
  });
  if (!task) {
    throw new UserError("Задача не найдена");
  }
  if (task.userId !== userId) {
    throw new UserError("Удалить совместное дело может только автор");
  }

  // Deleting only lowers completed counts, so it cannot unlock achievements.
  await prisma.task.delete({ where: { id: task.id } });
}

export async function keepTask(taskId: string, rawToday: string): Promise<ActionResult<void>> {
  return toResult(() => keepTaskInner(taskId, rawToday));
}

export async function archiveTask(taskId: string): Promise<ActionResult<void>> {
  return toResult(() => archiveTaskInner(taskId));
}

export async function restoreTask(taskId: string, rawToday: string): Promise<ActionResult<void>> {
  return toResult(() => restoreTaskInner(taskId, rawToday));
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult<TaskDTO>> {
  return toResult(() => createTaskInner(input));
}

export async function toggleTask(taskId: string): Promise<ActionResult<ToggleResult>> {
  return toResult(() => toggleTaskInner(taskId));
}

export async function removeTask(taskId: string): Promise<ActionResult<void>> {
  return toResult(() => removeTaskInner(taskId));
}

export async function deleteTask(taskId: string): Promise<ActionResult<void>> {
  return toResult(() => deleteTaskInner(taskId));
}
