"use server";

import { prisma } from "@/lib/prisma";
import { isLingering, resolveToday } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import {
  isDateKey,
  isTimeKey,
  TASK_ITEMS_MAX,
  TASK_ITEM_MAX,
  TASK_NOTE_MAX,
  TASK_TITLE_MAX,
} from "@/lib/validation";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import { syncAchievements } from "@/lib/achievement-stats";

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
  note: string | null;
  items: TaskItemDTO[];
};

export type TaskItemDTO = {
  id: string;
  text: string;
  done: boolean;
};

export type TaskItemInput = {
  text: string;
  done?: boolean;
};

export type CreateTaskInput = {
  title: string;
  date: string;
  time?: string | null;
  important?: boolean;
  urgent?: boolean;
  friendIds?: string[];
  note?: string | null;
  /** The checklist; omitted keeps the current one when editing. */
  items?: TaskItemInput[];
};

export type ToggleResult = {
  task: TaskDTO;
  newlyUnlocked: string[];
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
      select: { keptOn: true },
    },
    items: {
      select: { id: true, text: true, done: true },
      orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
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
  viewerStates: { keptOn: string | null }[];
  note: string | null;
  items: TaskItemDTO[];
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
    note: task.note,
    items: task.items,
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

// The archive is gone: every task the user can see is open to them,
// including ones archived before, which now come back with a keep/delete prompt.
function openWhere(userId: string) {
  return accessWhere(userId);
}

function completedWhere(userId: string) {
  return {
    done: true,
    ...accessWhere(userId),
  };
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
  /** How many overdue tasks were moved. */
  movedCount: number;
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
  return {
    prompts: await present(lingering, userId),
    moved: overdue.length > 0,
    movedCount: overdue.length,
  };
}

async function touchViewer(userId: string, taskId: string, data: { keptOn: string }) {
  await prisma.taskViewerState.upsert({
    where: { userId_taskId: { userId, taskId } },
    create: { userId, taskId, ...data, archived: false, archivedAt: null },
    update: { ...data, archived: false, archivedAt: null },
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
  await touchViewer(userId, task.id, { keptOn: today });
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

function cleanNote(raw: string | null | undefined): string | null {
  const note = (raw ?? "").trim();
  if (note.length > TASK_NOTE_MAX) throw new UserError(`Заметка длиннее ${TASK_NOTE_MAX} символов`);
  return note || null;
}

function cleanItemText(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length > TASK_ITEM_MAX) throw new UserError(`Пункт длиннее ${TASK_ITEM_MAX} символов`);
  return text;
}

function cleanItems(raw: TaskItemInput[] | undefined): { text: string; done: boolean; position: number }[] {
  const items = (raw ?? [])
    .map((item) => ({ text: cleanItemText(String(item.text ?? "")), done: Boolean(item.done) }))
    .filter((item) => item.text);
  if (items.length > TASK_ITEMS_MAX) throw new UserError(`В списке может быть до ${TASK_ITEMS_MAX} пунктов`);
  return items.map((item, position) => ({ ...item, position }));
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

  const note = cleanNote(input.note);
  const items = cleanItems(input.items);
  const task = await prisma.task.create({
    data: {
      userId,
      title,
      date: input.date,
      originDate: input.date,
      time,
      important: Boolean(input.important),
      urgent: Boolean(input.urgent),
      note,
      items: { create: items },
      shares: {
        create: friendIds.map((friendId) => ({ userId: friendId })),
      },
    },
    include: includeFor(userId),
  });

  const [dto] = await present([task], userId);
  return dto;
}

async function updateTaskInner(taskId: string, input: CreateTaskInput): Promise<TaskDTO> {
  const userId = await requireUserId();
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...accessWhere(userId) },
    select: { id: true, userId: true, date: true, done: true, shares: { select: { userId: true } } },
  });
  if (!task) throw new UserError("Задача не найдена");
  if (task.userId !== userId) throw new UserError("Изменить совместное дело может только автор");

  const title = input.title.trim();
  if (!title) throw new UserError("Название обязательно");
  if (title.length > TASK_TITLE_MAX) throw new UserError(`Название длиннее ${TASK_TITLE_MAX} символов`);
  if (!isDateKey(input.date)) throw new UserError("Некорректная дата");
  let time: string | null = null;
  if (input.time && input.time.trim()) {
    if (!isTimeKey(input.time.trim())) throw new UserError("Некорректное время");
    time = input.time.trim();
  }

  const friendIds = [...new Set((input.friendIds ?? []).filter((id) => id && id !== userId))];
  const current = new Set(task.shares.map((share) => share.userId));
  const added = friendIds.filter((id) => !current.has(id));
  const allowed = await acceptedFriendIds(userId, added);
  if (added.some((id) => !allowed.has(id))) {
    throw new UserError("Совместное дело можно добавить только с друзьями");
  }
  const removed = [...current].filter((id) => !friendIds.includes(id));

  const note = cleanNote(input.note);
  const items = input.items === undefined ? null : cleanItems(input.items);

  // Moving a task to another day is a fresh plan, so it stops counting as carried over.
  const moved = input.date !== task.date;
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      title,
      time,
      important: Boolean(input.important),
      urgent: Boolean(input.urgent),
      note,
      ...(items
        ? {
            items: { deleteMany: {}, create: items },
            // The list decides whether the task is closed.
            ...(items.length > 0
              ? items.every((item) => item.done)
                ? { done: true, doneAt: task.done ? undefined : new Date() }
                : { done: false, doneAt: null }
              : {}),
          }
        : {}),
      ...(moved ? { date: input.date, originDate: input.date } : {}),
      shares: {
        deleteMany: removed.length > 0 ? { userId: { in: removed } } : [],
        create: added.map((friendId) => ({ userId: friendId })),
      },
    },
    include: includeFor(userId),
  });
  const [dto] = await present([updated], userId);
  return dto;
}

async function toggleTaskInner(taskId: string): Promise<ToggleResult> {
  const userId = await requireUserId();
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...openWhere(userId) },
    select: {
      id: true,
      userId: true,
      done: true,
      shares: { select: { userId: true } },
      items: { select: { done: true } },
    },
  });
  if (!task) {
    throw new UserError("Задача не найдена");
  }

  const done = !task.done;
  if (done && task.items.some((item) => !item.done)) {
    throw new UserError("Сначала отметьте все пункты списка");
  }
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

/** Completes the task when its last item is checked and reopens it when one is unchecked. */
async function closeByItems(taskId: string, userId: string): Promise<ToggleResult> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      id: true,
      userId: true,
      done: true,
      shares: { select: { userId: true } },
      items: { select: { done: true } },
    },
  });
  const allDone = task.items.length > 0 && task.items.every((item) => item.done);
  const closing = allDone && !task.done;
  if (closing || (!allDone && task.done && task.items.length > 0)) {
    await prisma.task.update({
      where: { id: task.id },
      data: { done: allDone, doneAt: allDone ? new Date() : null },
    });
  }
  const involved = closing ? [task.userId, ...task.shares.map((share) => share.userId)] : [];
  const [fresh, synced] = await Promise.all([
    prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: includeFor(userId) }),
    Promise.all(involved.map(syncAchievements)),
  ]);
  const [dto] = await present([fresh], userId);
  return { task: dto, newlyUnlocked: synced[involved.indexOf(userId)]?.newlyUnlocked ?? [] };
}

async function findItemTask(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...accessWhere(userId) },
    select: { id: true, _count: { select: { items: true } } },
  });
  if (!task) throw new UserError("Задача не найдена");
  return task;
}

async function toggleTaskItemInner(taskId: string, itemId: string): Promise<ToggleResult> {
  const userId = await requireUserId();
  await findItemTask(taskId, userId);
  const item = await prisma.taskItem.findFirst({ where: { id: itemId, taskId }, select: { done: true } });
  if (!item) throw new UserError("Пункт не найден");
  await prisma.taskItem.update({ where: { id: itemId }, data: { done: !item.done } });
  return closeByItems(taskId, userId);
}

async function addTaskItemInner(taskId: string, rawText: string): Promise<ToggleResult> {
  const userId = await requireUserId();
  const task = await findItemTask(taskId, userId);
  const lines = String(rawText ?? "")
    .split(/\n|;/)
    .map(cleanItemText)
    .filter(Boolean);
  if (lines.length === 0) throw new UserError("Напишите, что добавить");
  if (task._count.items + lines.length > TASK_ITEMS_MAX) {
    throw new UserError(`В списке может быть до ${TASK_ITEMS_MAX} пунктов`);
  }
  const last = await prisma.taskItem.aggregate({ where: { taskId }, _max: { position: true } });
  const start = (last._max.position ?? -1) + 1;
  await prisma.taskItem.createMany({
    data: lines.map((text, i) => ({ taskId, text, position: start + i })),
  });
  return closeByItems(taskId, userId);
}

async function removeTaskItemInner(taskId: string, itemId: string): Promise<ToggleResult> {
  const userId = await requireUserId();
  await findItemTask(taskId, userId);
  const { count } = await prisma.taskItem.deleteMany({ where: { id: itemId, taskId } });
  if (count === 0) throw new UserError("Пункт не найден");
  return closeByItems(taskId, userId);
}

async function moveTaskInner(taskId: string, date: string, originDate?: string | null): Promise<TaskDTO> {
  const userId = await requireUserId();
  if (!isDateKey(date)) throw new UserError("Некорректная дата");
  if (originDate != null && !isDateKey(originDate)) throw new UserError("Некорректная дата");
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...accessWhere(userId) },
    select: { id: true, userId: true },
  });
  if (!task) throw new UserError("Задача не найдена");
  if (task.userId !== userId) throw new UserError("Перенести совместное дело может только автор");
  const updated = await prisma.task.update({
    where: { id: task.id },
    // A moved task is a fresh plan; undo passes the old origin back.
    data: { date, originDate: originDate ?? date },
    include: includeFor(userId),
  });
  const [dto] = await present([updated], userId);
  return dto;
}

export type SearchHit = TaskDTO;

async function searchTasksInner(rawQuery: string): Promise<SearchHit[]> {
  const userId = await requireUserId();
  const query = String(rawQuery ?? "").trim().slice(0, 80);
  if (query.length < 2) return [];
  const contains = { contains: query, mode: "insensitive" as const };
  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        accessWhere(userId),
        { OR: [{ title: contains }, { note: contains }, { items: { some: { text: contains } } }] },
      ],
    },
    include: includeFor(userId),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 40,
  });
  return present(tasks, userId);
}

export async function toggleTaskItem(taskId: string, itemId: string): Promise<ActionResult<ToggleResult>> {
  return toResult(() => toggleTaskItemInner(taskId, itemId));
}

export async function addTaskItem(taskId: string, text: string): Promise<ActionResult<ToggleResult>> {
  return toResult(() => addTaskItemInner(taskId, text));
}

export async function removeTaskItem(taskId: string, itemId: string): Promise<ActionResult<ToggleResult>> {
  return toResult(() => removeTaskItemInner(taskId, itemId));
}

export async function moveTask(
  taskId: string,
  date: string,
  originDate?: string | null,
): Promise<ActionResult<TaskDTO>> {
  return toResult(() => moveTaskInner(taskId, date, originDate));
}

export async function searchTasks(query: string): Promise<ActionResult<SearchHit[]>> {
  return toResult(() => searchTasksInner(query));
}

export async function keepTask(taskId: string, rawToday: string): Promise<ActionResult<void>> {
  return toResult(() => keepTaskInner(taskId, rawToday));
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult<TaskDTO>> {
  return toResult(() => createTaskInner(input));
}

export async function updateTask(
  taskId: string,
  input: CreateTaskInput,
): Promise<ActionResult<TaskDTO>> {
  return toResult(() => updateTaskInner(taskId, input));
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
