"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isDateKey } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import { isRepeatUnit, todayIn, type RepeatUnit } from "@/lib/reminders";
import { sendEmail } from "@/lib/email";
import { digestEmail } from "@/lib/email-templates";
import { digestTasks } from "@/lib/daily-job";

export type ReminderDTO = {
  id: string;
  title: string;
  everyCount: number;
  everyUnit: RepeatUnit;
  nextDate: string;
  remindDaysBefore: number;
  addToPlanner: boolean;
};

export type ReminderInput = Omit<ReminderDTO, "id">;

const TITLE_MAX = 100;
const REMINDERS_MAX = 30;

function clean(input: ReminderInput) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new UserError("Напишите, о чём напомнить");
  if (title.length > TITLE_MAX) throw new UserError(`Название не длиннее ${TITLE_MAX} символов`);
  const everyCount = Math.round(Number(input.everyCount));
  if (!Number.isFinite(everyCount) || everyCount < 1 || everyCount > 365) {
    throw new UserError("Как часто: число от 1 до 365");
  }
  if (!isRepeatUnit(input.everyUnit)) throw new UserError("Как часто: выберите период");
  if (!isDateKey(input.nextDate)) throw new UserError("Укажите дату следующего раза");
  const remindDaysBefore = Math.round(Number(input.remindDaysBefore));
  if (!Number.isFinite(remindDaysBefore) || remindDaysBefore < 0 || remindDaysBefore > 60) {
    throw new UserError("Напомнить можно за 0–60 дней");
  }
  return {
    title,
    everyCount,
    everyUnit: input.everyUnit,
    nextDate: input.nextDate,
    remindDaysBefore,
    addToPlanner: Boolean(input.addToPlanner),
  };
}

function toDTO(r: {
  id: string;
  title: string;
  everyCount: number;
  everyUnit: string;
  nextDate: string;
  remindDaysBefore: number;
  addToPlanner: boolean;
}): ReminderDTO {
  return { ...r, everyUnit: isRepeatUnit(r.everyUnit) ? r.everyUnit : "month" };
}

export async function listReminders(): Promise<ReminderDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.reminder.findMany({
    where: { userId },
    orderBy: { nextDate: "asc" },
  });
  return rows.map(toDTO);
}

async function createInner(input: ReminderInput): Promise<ReminderDTO> {
  const userId = await requireUserId();
  const data = clean(input);
  if ((await prisma.reminder.count({ where: { userId } })) >= REMINDERS_MAX) {
    throw new UserError(`Можно завести до ${REMINDERS_MAX} напоминаний`);
  }
  return toDTO(await prisma.reminder.create({ data: { ...data, userId } }));
}

async function updateInner(id: string, input: ReminderInput): Promise<ReminderDTO> {
  const userId = await requireUserId();
  const data = clean(input);
  const own = await prisma.reminder.findFirst({ where: { id, userId }, select: { nextDate: true } });
  if (!own) throw new UserError("Напоминание не найдено");
  // A new date is a new occurrence: let it be emailed and planned again.
  const reset = own.nextDate !== data.nextDate ? { lastNotifiedFor: null, lastPlannedFor: null } : {};
  return toDTO(await prisma.reminder.update({ where: { id }, data: { ...data, ...reset } }));
}

async function deleteInner(id: string): Promise<void> {
  const userId = await requireUserId();
  const result = await prisma.reminder.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new UserError("Напоминание не найдено");
}

export async function createReminder(input: ReminderInput): Promise<ActionResult<ReminderDTO>> {
  return toResult(() => createInner(input));
}

export async function updateReminder(
  id: string,
  input: ReminderInput,
): Promise<ActionResult<ReminderDTO>> {
  return toResult(() => updateInner(id, input));
}

export async function deleteReminder(id: string): Promise<ActionResult<void>> {
  return toResult(() => deleteInner(id));
}

// ---------- morning digest and health emails ----------

export async function setHealthEmails(enabled: boolean): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await prisma.user.update({ where: { id: userId }, data: { healthEmails: enabled } });
  });
}

export async function setDigest(enabled: boolean): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await prisma.user.update({ where: { id: userId }, data: { digestEnabled: enabled } });
  });
}

/** Sends today's digest right now, to see what it looks like. */
export async function sendDigestNow(): Promise<ActionResult<string>> {
  return toResult(async () => {
    const userId = await requireUserId();
    if (!(await rateLimit(`digest-test:${userId}`, 3, 60 * 60))) {
      throw new UserError("Пробных писем — не больше 3 в час");
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, timeZone: true },
    });
    if (!user) throw new UserError("Аккаунт не найден");
    const today = todayIn(user.timeZone);
    const tasks = await digestTasks(userId, today);
    if (tasks.length === 0) return "На сегодня дел нет — в такие дни письмо не приходит";
    try {
      await sendEmail(digestEmail(user.email, user.name, today, tasks));
    } catch (error) {
      console.error("digest test failed", error);
      throw new UserError("Не удалось отправить письмо. Попробуйте позже.");
    }
    return `Письмо отправлено на ${user.email}`;
  });
}
