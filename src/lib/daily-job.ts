import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { digestEmail, reminderEmail, type DigestTask } from "@/lib/email-templates";
import {
  catchUp,
  describeIn,
  describeRepeat,
  isRepeatUnit,
  todayIn,
} from "@/lib/reminders";
import { fromDateKey } from "@/lib/dates";
import { differenceInCalendarDays } from "date-fns";

export type DailyReport = { digests: number; reminderEmails: number; plannerTasks: number; failed: number };

/** Open tasks for a user's day, urgent and important first. */
export async function digestTasks(userId: string, today: string): Promise<DigestTask[]> {
  const tasks = await prisma.task.findMany({
    where: {
      done: false,
      date: { lte: today },
      OR: [{ userId }, { shares: { some: { userId } } }],
    },
    select: { title: true, time: true, important: true, urgent: true },
    orderBy: [{ urgent: "desc" }, { important: "desc" }, { time: "asc" }, { createdAt: "asc" }],
    take: 50,
  });
  return tasks;
}

async function processReminders(now: Date, report: DailyReport) {
  const reminders = await prisma.reminder.findMany({
    include: { user: { select: { email: true, timeZone: true } } },
  });

  for (const r of reminders) {
    if (!isRepeatUnit(r.everyUnit) || r.everyCount < 1) continue;
    const today = todayIn(r.user.timeZone, now);
    try {
      // Past occurrences roll forward to the next one.
      let nextDate = r.nextDate;
      if (nextDate < today) nextDate = catchUp(nextDate, today, r.everyCount, r.everyUnit);
      const data: { nextDate?: string; lastPlannedFor?: string; lastNotifiedFor?: string } = {};
      if (nextDate !== r.nextDate) data.nextDate = nextDate;

      if (r.addToPlanner && nextDate === today && r.lastPlannedFor !== nextDate) {
        await prisma.task.create({
          data: { userId: r.userId, title: r.title, date: today, originDate: today, important: true },
        });
        data.lastPlannedFor = nextDate;
        report.plannerTasks += 1;
      }

      const daysLeft = differenceInCalendarDays(fromDateKey(nextDate), fromDateKey(today));
      if (daysLeft <= r.remindDaysBefore && r.lastNotifiedFor !== nextDate) {
        await sendEmail(
          reminderEmail(
            r.user.email,
            r.title,
            nextDate,
            describeIn(today, nextDate),
            describeRepeat(r.everyCount, r.everyUnit),
          ),
        );
        data.lastNotifiedFor = nextDate;
        report.reminderEmails += 1;
      }

      if (Object.keys(data).length > 0) {
        await prisma.reminder.update({ where: { id: r.id }, data });
      }
    } catch (error) {
      report.failed += 1;
      console.error("reminder failed", r.id, error);
    }
  }
}

async function processDigests(now: Date, report: DailyReport) {
  const users = await prisma.user.findMany({
    where: { digestEnabled: true },
    select: { id: true, email: true, name: true, timeZone: true, lastDigestOn: true },
  });
  for (const user of users) {
    try {
      const today = todayIn(user.timeZone, now);
      if (user.lastDigestOn === today) continue; // cron can fire twice
      const tasks = await digestTasks(user.id, today);
      if (tasks.length === 0) continue; // nothing planned: no letter
      await sendEmail(digestEmail(user.email, user.name, today, tasks));
      await prisma.user.update({ where: { id: user.id }, data: { lastDigestOn: today } });
      report.digests += 1;
    } catch (error) {
      report.failed += 1;
      console.error("digest failed", user.id, error);
    }
  }
}

/** Runs once a morning: repeating reminders first (they may add today's tasks), then digests. */
export async function runDailyJob(now = new Date()): Promise<DailyReport> {
  const report: DailyReport = { digests: 0, reminderEmails: 0, plannerTasks: 0, failed: 0 };
  await processReminders(now, report);
  await processDigests(now, report);
  return report;
}

