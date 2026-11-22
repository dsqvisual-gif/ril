"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isDateKey } from "@/lib/validation";
import { normalizeUsername } from "@/lib/username";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";

// ---------- sharing a child ----------

export type CaregiverDTO = {
  id: string;
  name: string;
  username: string | null;
  status: "invited" | "active";
};

export type ChildInviteDTO = { id: string; childName: string; fromName: string | null };

const CAREGIVERS_MAX = 6;

async function ownedChild(userId: string, childId: string) {
  const child = await prisma.child.findFirst({ where: { id: childId, userId }, select: { id: true } });
  if (!child) throw new UserError("Делиться может только тот, кто добавил малыша");
  return child;
}

async function caregivers(childId: string): Promise<CaregiverDTO[]> {
  const rows = await prisma.childAccess.findMany({
    where: { childId },
    include: { user: { select: { name: true, username: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.user.name,
    username: r.user.username,
    status: r.status === "active" ? "active" : "invited",
  }));
}

export async function listCaregivers(childId: string): Promise<ActionResult<CaregiverDTO[]>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await ownedChild(userId, childId);
    return caregivers(childId);
  });
}

export async function inviteCaregiver(
  childId: string,
  rawUsername: string,
): Promise<ActionResult<CaregiverDTO[]>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await ownedChild(userId, childId);
    const username = normalizeUsername(rawUsername);
    if (!username) throw new UserError("Укажите ник");
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw new UserError(`Пользователь @${username} не найден`);
    if (user.id === userId) throw new UserError("Это ваш собственный ник");
    if ((await prisma.childAccess.count({ where: { childId } })) >= CAREGIVERS_MAX) {
      throw new UserError(`Можно пригласить до ${CAREGIVERS_MAX} человек`);
    }
    const existing = await prisma.childAccess.findUnique({
      where: { childId_userId: { childId, userId: user.id } },
    });
    if (existing) {
      throw new UserError(existing.status === "active" ? "У этого человека уже есть доступ" : "Приглашение уже отправлено");
    }
    await prisma.childAccess.create({ data: { childId, userId: user.id, invitedById: userId } });
    return caregivers(childId);
  });
}

/** The owner removes someone, or a caregiver leaves. */
export async function removeCaregiver(accessId: string): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const row = await prisma.childAccess.findUnique({
      where: { id: accessId },
      include: { child: { select: { userId: true } } },
    });
    if (!row || (row.userId !== userId && row.child.userId !== userId)) {
      throw new UserError("Доступ не найден");
    }
    await prisma.childAccess.delete({ where: { id: accessId } });
    revalidatePath("/app", "layout");
  });
}

export async function listChildInvites(): Promise<ChildInviteDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.childAccess.findMany({
    where: { userId, status: "invited" },
    include: { child: { select: { name: true, user: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ id: r.id, childName: r.child.name, fromName: r.child.user.name }));
}

/** Accepting also turns on mom mode, so the baby menu appears. */
export async function respondChildInvite(accessId: string, accept: boolean): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const row = await prisma.childAccess.findFirst({ where: { id: accessId, userId, status: "invited" } });
    if (!row) throw new UserError("Приглашение не найдено");
    if (accept) {
      await prisma.$transaction([
        prisma.childAccess.update({ where: { id: row.id }, data: { status: "active" } }),
        prisma.user.update({ where: { id: userId }, data: { momMode: true } }),
      ]);
    } else {
      await prisma.childAccess.delete({ where: { id: row.id } });
    }
    revalidatePath("/app", "layout");
  });
}

// ---------- vaccinations and doctor visits ----------

export type HealthKind = "vaccine" | "visit";

export type HealthDTO = {
  id: string;
  kind: HealthKind;
  title: string;
  date: string;
  done: boolean;
  note: string | null;
  remindDaysBefore: number;
};

export type HealthInput = Omit<HealthDTO, "id" | "done">;

async function reachableChild(userId: string, childId: string) {
  const child = await prisma.child.findFirst({
    where: { id: childId, OR: [{ userId }, { access: { some: { userId, status: "active" } } }] },
    select: { id: true },
  });
  if (!child) throw new UserError("Ребёнок не найден");
  return child;
}

async function reachableHealth(userId: string, id: string) {
  const row = await prisma.babyHealth.findFirst({
    where: { id, child: { OR: [{ userId }, { access: { some: { userId, status: "active" } } }] } },
  });
  if (!row) throw new UserError("Запись не найдена");
  return row;
}

function healthDTO(r: {
  id: string;
  kind: string;
  title: string;
  date: string;
  done: boolean;
  note: string | null;
  remindDaysBefore: number;
}): HealthDTO {
  return {
    id: r.id,
    kind: r.kind === "vaccine" ? "vaccine" : "visit",
    title: r.title,
    date: r.date,
    done: r.done,
    note: r.note,
    remindDaysBefore: r.remindDaysBefore,
  };
}

function cleanHealth(input: HealthInput) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new UserError("Что за прививка или визит?");
  if (title.length > 80) throw new UserError("Название не длиннее 80 символов");
  if (!isDateKey(input.date)) throw new UserError("Укажите дату");
  const remind = Math.round(Number(input.remindDaysBefore));
  if (!Number.isFinite(remind) || remind < 0 || remind > 30) throw new UserError("Напомнить можно за 0–30 дней");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 300) || null : null;
  return { kind: input.kind === "vaccine" ? "vaccine" : "visit", title, date: input.date, remindDaysBefore: remind, note };
}

export async function listHealth(childId: string): Promise<ActionResult<HealthDTO[]>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await reachableChild(userId, childId);
    const rows = await prisma.babyHealth.findMany({ where: { childId }, orderBy: { date: "asc" } });
    return rows.map(healthDTO);
  });
}

export async function saveHealth(
  childId: string,
  id: string | null,
  input: HealthInput,
): Promise<ActionResult<HealthDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await reachableChild(userId, childId);
    const data = cleanHealth(input);
    if (id) {
      const row = await reachableHealth(userId, id);
      // A new date means a new reminder email.
      const reset = row.date !== data.date ? { lastNotifiedFor: null } : {};
      return healthDTO(await prisma.babyHealth.update({ where: { id }, data: { ...data, ...reset } }));
    }
    if ((await prisma.babyHealth.count({ where: { childId } })) >= 300) {
      throw new UserError("Слишком много записей");
    }
    return healthDTO(await prisma.babyHealth.create({ data: { ...data, childId } }));
  });
}

export async function setHealthDone(id: string, done: boolean): Promise<ActionResult<HealthDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await reachableHealth(userId, id);
    return healthDTO(await prisma.babyHealth.update({ where: { id }, data: { done } }));
  });
}

export async function deleteHealth(id: string): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await reachableHealth(userId, id);
    await prisma.babyHealth.delete({ where: { id } });
  });
}

/** A caregiver stops tracking a child shared with them. */
export async function leaveChild(childId: string): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const result = await prisma.childAccess.deleteMany({ where: { childId, userId } });
    if (result.count === 0) throw new UserError("Доступ не найден");
    revalidatePath("/app", "layout");
  });
}
