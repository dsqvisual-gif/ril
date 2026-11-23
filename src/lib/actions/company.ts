"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isDateKey } from "@/lib/validation";
import { normalizeUsername } from "@/lib/username";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";

export type CompanyRole = "owner" | "admin" | "member";
export type CompanyTaskStatus = "todo" | "doing" | "done";

export type CompanySummary = {
  id: string;
  name: string;
  plan: string;
  role: CompanyRole;
  memberCount: number;
};

export type CompanyInvitation = {
  memberId: string;
  companyId: string;
  companyName: string;
  invitedBy: string | null;
};

export type CompanyMemberDTO = {
  id: string;
  userId: string;
  name: string;
  username: string | null;
  role: CompanyRole;
  status: "invited" | "active";
};

export type CompanyTaskDTO = {
  id: string;
  title: string;
  note: string | null;
  assigneeId: string | null;
  creatorId: string;
  startDate: string;
  deadline: string | null;
  status: CompanyTaskStatus;
  important: boolean;
  doneAt: string | null;
};

export type CompanyView = {
  company: { id: string; name: string; plan: string };
  me: { userId: string; role: CompanyRole };
  members: CompanyMemberDTO[];
  tasks: CompanyTaskDTO[];
};

export type CompanyTaskInput = {
  title: string;
  note?: string | null;
  assigneeId?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  important?: boolean;
};

export type CompanyTaskPatch = Partial<CompanyTaskInput> & { status?: CompanyTaskStatus };

const NAME_MAX = 80;
const TITLE_MAX = 140;
const NOTE_MAX = 1000;
const COMPANIES_MAX = 10;
const MEMBERS_MAX = 100;
const STATUSES: CompanyTaskStatus[] = ["todo", "doing", "done"];

// ---------- helpers ----------

function text(raw: unknown, max: number, label: string, required: boolean): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    if (required) throw new UserError(`${label}: заполните поле`);
    return null;
  }
  if (value.length > max) throw new UserError(`${label}: не длиннее ${max} символов`);
  return value;
}

function dateOrNull(raw: unknown, label: string): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  if (!isDateKey(value)) throw new UserError(`${label}: некорректная дата`);
  return value;
}

function isManager(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** The caller's active membership, or a user-facing error. */
async function membership(userId: string, companyId: string) {
  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (!member || member.status !== "active") throw new UserError("Компания не найдена");
  return member;
}

async function requireManager(userId: string, companyId: string) {
  const member = await membership(userId, companyId);
  if (!isManager(member.role)) {
    throw new UserError("Это может только владелец или администратор компании");
  }
  return member;
}

function taskDTO(task: {
  id: string;
  title: string;
  note: string | null;
  assigneeId: string | null;
  creatorId: string;
  startDate: string | null;
  deadline: string | null;
  status: string;
  important: boolean;
  doneAt: Date | null;
  createdAt: Date;
}): CompanyTaskDTO {
  return {
    id: task.id,
    title: task.title,
    note: task.note,
    assigneeId: task.assigneeId,
    creatorId: task.creatorId,
    startDate: task.startDate ?? task.createdAt.toISOString().slice(0, 10),
    deadline: task.deadline,
    status: (STATUSES as string[]).includes(task.status) ? (task.status as CompanyTaskStatus) : "todo",
    important: task.important,
    doneAt: task.doneAt ? task.doneAt.toISOString() : null,
  };
}

async function activeAssignee(companyId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return null;
  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId: assigneeId } },
  });
  if (!member || member.status !== "active") {
    throw new UserError("Задачу можно назначить только участнику компании");
  }
  return assigneeId;
}

// ---------- reads ----------

export async function listMyCompanies(): Promise<{
  companies: CompanySummary[];
  invitations: CompanyInvitation[];
}> {
  const userId = await requireUserId();
  const rows = await prisma.companyMember.findMany({
    where: { userId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          plan: true,
          _count: { select: { members: { where: { status: "active" } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const inviterIds = rows.map((r) => r.invitedById).filter((id): id is string => Boolean(id));
  const inviters = inviterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: inviterIds } },
        select: { id: true, name: true },
      })
    : [];
  const inviterName = new Map(inviters.map((u) => [u.id, u.name]));

  return {
    companies: rows
      .filter((r) => r.status === "active")
      .map((r) => ({
        id: r.company.id,
        name: r.company.name,
        plan: r.company.plan,
        role: r.role as CompanyRole,
        memberCount: r.company._count.members,
      })),
    invitations: rows
      .filter((r) => r.status === "invited")
      .map((r) => ({
        memberId: r.id,
        companyId: r.company.id,
        companyName: r.company.name,
        invitedBy: r.invitedById ? (inviterName.get(r.invitedById) ?? null) : null,
      })),
  };
}

async function viewInner(companyId: string): Promise<CompanyView> {
  const userId = await requireUserId();
  const me = await membership(userId, companyId);
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, username: true } } },
        orderBy: { createdAt: "asc" },
      },
      tasks: { orderBy: [{ deadline: "asc" }, { createdAt: "asc" }] },
    },
  });
  return {
    company: { id: company.id, name: company.name, plan: company.plan },
    me: { userId, role: me.role as CompanyRole },
    members: company.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      username: m.user.username,
      role: m.role as CompanyRole,
      status: m.status === "active" ? "active" : "invited",
    })),
    tasks: company.tasks.map(taskDTO),
  };
}

// ---------- companies & members ----------

async function createCompanyInner(rawName: string): Promise<CompanyView> {
  const userId = await requireUserId();
  const name = text(rawName, NAME_MAX, "Название компании", true)!;
  const owned = await prisma.companyMember.count({ where: { userId, role: "owner" } });
  if (owned >= COMPANIES_MAX) throw new UserError(`Можно создать до ${COMPANIES_MAX} компаний`);
  const company = await prisma.company.create({
    data: { name, members: { create: { userId, role: "owner", status: "active" } } },
  });
  return viewInner(company.id);
}

async function renameCompanyInner(companyId: string, rawName: string): Promise<CompanyView> {
  const userId = await requireUserId();
  await requireManager(userId, companyId);
  const name = text(rawName, NAME_MAX, "Название компании", true)!;
  await prisma.company.update({ where: { id: companyId }, data: { name } });
  return viewInner(companyId);
}

async function deleteCompanyInner(companyId: string): Promise<void> {
  const userId = await requireUserId();
  const me = await membership(userId, companyId);
  if (me.role !== "owner") throw new UserError("Удалить компанию может только владелец");
  await prisma.company.delete({ where: { id: companyId } });
}

async function inviteInner(companyId: string, rawUsername: string): Promise<CompanyView> {
  const userId = await requireUserId();
  await requireManager(userId, companyId);
  const username = normalizeUsername(rawUsername.replace(/^@/, ""));
  if (!username) throw new UserError("Укажите ник");
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) throw new UserError(`Пользователь @${username} не найден`);

  const existing = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId: user.id } },
  });
  if (existing) {
    throw new UserError(
      existing.status === "active" ? "Этот человек уже в компании" : "Приглашение уже отправлено",
    );
  }
  const count = await prisma.companyMember.count({ where: { companyId } });
  if (count >= MEMBERS_MAX) throw new UserError(`В компании может быть до ${MEMBERS_MAX} человек`);

  await prisma.companyMember.create({
    data: { companyId, userId: user.id, role: "member", status: "invited", invitedById: userId },
  });
  return viewInner(companyId);
}

async function respondInner(memberId: string, accept: boolean): Promise<void> {
  const userId = await requireUserId();
  const invite = await prisma.companyMember.findFirst({
    where: { id: memberId, userId, status: "invited" },
  });
  if (!invite) throw new UserError("Приглашение не найдено");
  if (accept) {
    await prisma.companyMember.update({ where: { id: invite.id }, data: { status: "active" } });
  } else {
    await prisma.companyMember.delete({ where: { id: invite.id } });
  }
}

async function removeMemberInner(companyId: string, memberId: string): Promise<CompanyView | null> {
  const userId = await requireUserId();
  const me = await membership(userId, companyId);
  const target = await prisma.companyMember.findFirst({ where: { id: memberId, companyId } });
  if (!target) throw new UserError("Участник не найден");
  if (target.role === "owner") throw new UserError("Владельца нельзя убрать из компании");
  const self = target.userId === userId;
  if (!self && !isManager(me.role)) {
    throw new UserError("Убрать участника может только владелец или администратор");
  }
  if (!self && target.role === "admin" && me.role !== "owner") {
    throw new UserError("Администратора может убрать только владелец");
  }

  await prisma.$transaction([
    prisma.companyTask.updateMany({
      where: { companyId, assigneeId: target.userId },
      data: { assigneeId: null },
    }),
    prisma.companyMember.delete({ where: { id: target.id } }),
  ]);
  return self ? null : viewInner(companyId);
}

async function setRoleInner(
  companyId: string,
  memberId: string,
  role: CompanyRole,
): Promise<CompanyView> {
  const userId = await requireUserId();
  const me = await membership(userId, companyId);
  if (me.role !== "owner") throw new UserError("Роли меняет только владелец");
  if (role !== "admin" && role !== "member") throw new UserError("Неизвестная роль");
  const target = await prisma.companyMember.findFirst({ where: { id: memberId, companyId } });
  if (!target || target.role === "owner") throw new UserError("Участник не найден");
  await prisma.companyMember.update({ where: { id: target.id }, data: { role } });
  return viewInner(companyId);
}

// ---------- tasks ----------

async function createTaskInner(companyId: string, input: CompanyTaskInput): Promise<CompanyView> {
  const userId = await requireUserId();
  const me = await membership(userId, companyId);
  if (!isManager(me.role)) throw new UserError("Задачи добавляют владелец и администраторы");
  const title = text(input.title, TITLE_MAX, "Задача", true)!;
  const note = text(input.note, NOTE_MAX, "Описание", false);
  const startDate = dateOrNull(input.startDate, "Начало");
  const deadline = dateOrNull(input.deadline, "Дедлайн");
  if (startDate && deadline && startDate > deadline) {
    throw new UserError("Дедлайн раньше даты начала");
  }
  const assigneeId = await activeAssignee(companyId, input.assigneeId);

  await prisma.companyTask.create({
    data: {
      companyId,
      creatorId: userId,
      title,
      note,
      assigneeId,
      startDate,
      deadline,
      important: Boolean(input.important),
    },
  });
  return viewInner(companyId);
}

async function updateTaskInner(taskId: string, patch: CompanyTaskPatch): Promise<CompanyView> {
  const userId = await requireUserId();
  const task = await prisma.companyTask.findUnique({ where: { id: taskId } });
  if (!task) throw new UserError("Задача не найдена");
  const me = await membership(userId, task.companyId);
  // Admins run the team's tasks; everyone else only marks how their own task is going.
  const canEdit = isManager(me.role);
  const isAssignee = task.assigneeId === userId;

  const editsDetails = Object.keys(patch).some((key) => key !== "status");
  if (editsDetails && !canEdit) {
    throw new UserError("Менять задачу могут владелец и администраторы");
  }
  if (patch.status !== undefined && !canEdit && !isAssignee) {
    throw new UserError("Статус меняет исполнитель или администратор");
  }

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = text(patch.title, TITLE_MAX, "Задача", true);
  if (patch.note !== undefined) data.note = text(patch.note, NOTE_MAX, "Описание", false);
  if (patch.startDate !== undefined) data.startDate = dateOrNull(patch.startDate, "Начало");
  if (patch.deadline !== undefined) data.deadline = dateOrNull(patch.deadline, "Дедлайн");
  if (patch.important !== undefined) data.important = Boolean(patch.important);
  if (patch.assigneeId !== undefined) {
    data.assigneeId = await activeAssignee(task.companyId, patch.assigneeId);
  }
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) throw new UserError("Неизвестный статус");
    data.status = patch.status;
    data.doneAt = patch.status === "done" ? (task.doneAt ?? new Date()) : null;
  }

  const start = (data.startDate as string | null | undefined) ?? task.startDate;
  const end = (data.deadline as string | null | undefined) ?? task.deadline;
  if (start && end && start > end) throw new UserError("Дедлайн раньше даты начала");

  await prisma.companyTask.update({ where: { id: task.id }, data });
  return viewInner(task.companyId);
}

async function deleteTaskInner(taskId: string): Promise<CompanyView> {
  const userId = await requireUserId();
  const task = await prisma.companyTask.findUnique({ where: { id: taskId } });
  if (!task) throw new UserError("Задача не найдена");
  const me = await membership(userId, task.companyId);
  if (!isManager(me.role)) {
    throw new UserError("Удалить задачу могут владелец и администраторы");
  }
  await prisma.companyTask.delete({ where: { id: task.id } });
  return viewInner(task.companyId);
}

// ---------- exported actions ----------

export async function getCompanyView(companyId: string): Promise<ActionResult<CompanyView>> {
  return toResult(() => viewInner(companyId));
}

export async function createCompany(name: string): Promise<ActionResult<CompanyView>> {
  return toResult(() => createCompanyInner(name));
}

export async function renameCompany(
  companyId: string,
  name: string,
): Promise<ActionResult<CompanyView>> {
  return toResult(() => renameCompanyInner(companyId, name));
}

export async function deleteCompany(companyId: string): Promise<ActionResult<void>> {
  return toResult(() => deleteCompanyInner(companyId));
}

export async function inviteToCompany(
  companyId: string,
  username: string,
): Promise<ActionResult<CompanyView>> {
  return toResult(() => inviteInner(companyId, username));
}

export async function respondToInvitation(
  memberId: string,
  accept: boolean,
): Promise<ActionResult<void>> {
  return toResult(() => respondInner(memberId, accept));
}

export async function removeCompanyMember(
  companyId: string,
  memberId: string,
): Promise<ActionResult<CompanyView | null>> {
  return toResult(() => removeMemberInner(companyId, memberId));
}

export async function setCompanyMemberRole(
  companyId: string,
  memberId: string,
  role: CompanyRole,
): Promise<ActionResult<CompanyView>> {
  return toResult(() => setRoleInner(companyId, memberId, role));
}

export async function createCompanyTask(
  companyId: string,
  input: CompanyTaskInput,
): Promise<ActionResult<CompanyView>> {
  return toResult(() => createTaskInner(companyId, input));
}

export async function updateCompanyTask(
  taskId: string,
  patch: CompanyTaskPatch,
): Promise<ActionResult<CompanyView>> {
  return toResult(() => updateTaskInner(taskId, patch));
}

export async function deleteCompanyTask(taskId: string): Promise<ActionResult<CompanyView>> {
  return toResult(() => deleteTaskInner(taskId));
}
