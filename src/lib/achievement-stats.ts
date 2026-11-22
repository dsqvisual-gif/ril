import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { fromDateKey, shiftDateKey } from "@/lib/dates";
import { ACHIEVEMENTS, type Stats } from "@/lib/achievements";

/** Calendar day in Almaty, the clock activity days are counted by. */
export function almatyDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(date);
}

/** UTC calendar day of a timestamp, as a date key. */
function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function longestStreak(days: Set<string>): number {
  let best = 0;
  for (const day of days) {
    if (days.has(shiftDateKey(day, -1))) continue; // not the start of a run
    let length = 1;
    while (days.has(shiftDateKey(day, length))) length += 1;
    best = Math.max(best, length);
  }
  return best;
}

/** Everything the achievements are measured against, for one user. */
export async function computeStats(userId: string): Promise<Stats> {
  const access = { OR: [{ userId }, { shares: { some: { userId } } }] };

  const [user, tasks, friends, goals, companiesOwned, teamTasks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        activeDays: true,
        activeMinutes: true,
        useStreak: true,
        bestUseStreak: true,
        lastActiveOn: true,
      },
    }),
    prisma.task.findMany({
      where: access,
      select: {
        userId: true,
        date: true,
        originDate: true,
        done: true,
        important: true,
        urgent: true,
        _count: { select: { shares: true } },
        viewerStates: { where: { userId }, select: { keptOn: true } },
      },
    }),
    prisma.friendship.count({
      where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    }),
    prisma.goal.findMany({
      where: { userId },
      select: {
        createdAt: true,
        doneAt: true,
        deadline: true,
        steps: { select: { done: true } },
        _count: { select: { entries: true } },
      },
    }),
    prisma.companyMember.count({ where: { userId, role: "owner", status: "active" } }),
    prisma.companyTask.findMany({
      where: { assigneeId: userId, status: "done" },
      select: { deadline: true, doneAt: true },
    }),
  ]);

  const stats: Stats = {
    tasksDone: 0,
    importantDone: 0,
    urgentDone: 0,
    delayed3Done: 0,
    maxDelayDays: 0,
    bestDay: 0,
    cleanDays: 0,
    bestStreak: 0,
    sharedDone: 0,
    friends,
    keptThenDone: 0,
    comebackDay: 0,
    goalsCreated: goals.length,
    maxGoalSteps: 0,
    stepsDone: 0,
    entries: 0,
    goalsDone: 0,
    goalsOnTime: 0,
    longestGoalDays: 0,
    perfectGoals: 0,
    companiesOwned,
    teamDone: teamTasks.length,
    teamOnTime: 0,
    bestUseStreak: user?.bestUseStreak ?? 0,
    // The current run counts only while the last visit was today or yesterday.
    useStreak:
      user?.lastActiveOn && user.lastActiveOn >= shiftDateKey(almatyDay(new Date()), -1)
        ? user.useStreak
        : 0,
    activeDays: user?.activeDays ?? 0,
    daysWithUs: user ? Math.max(0, differenceInCalendarDays(new Date(), user.createdAt)) : 0,
    minutesInApp: user?.activeMinutes ?? 0,
  };

  // Tasks are grouped by their planned day: overdue ones move to today, so a
  // done task's date is the day it was finished and originDate the day it was planned.
  const perDay = new Map<string, { total: number; done: number; comeback: number }>();
  for (const task of tasks) {
    const day = perDay.get(task.date) ?? { total: 0, done: 0, comeback: 0 };
    day.total += 1;
    perDay.set(task.date, day);
    if (!task.done) continue;

    day.done += 1;
    stats.tasksDone += 1;
    if (task.important) stats.importantDone += 1;
    if (task.urgent) stats.urgentDone += 1;
    if (task._count.shares > 0 || task.userId !== userId) stats.sharedDone += 1;
    if (task.viewerStates[0]?.keptOn) stats.keptThenDone += 1;

    const delay = differenceInCalendarDays(
      fromDateKey(task.date),
      fromDateKey(task.originDate || task.date),
    );
    stats.maxDelayDays = Math.max(stats.maxDelayDays, delay);
    if (delay >= 3) stats.delayed3Done += 1;
    if (delay >= 7) day.comeback += 1;
  }

  const activeDays = new Set<string>();
  for (const [date, day] of perDay) {
    if (day.done > 0) activeDays.add(date);
    stats.bestDay = Math.max(stats.bestDay, day.done);
    stats.comebackDay = Math.max(stats.comebackDay, day.comeback);
    if (day.total >= 3 && day.done === day.total) stats.cleanDays += 1;
  }
  stats.bestStreak = longestStreak(activeDays);

  for (const goal of goals) {
    const done = goal.steps.filter((s) => s.done).length;
    stats.maxGoalSteps = Math.max(stats.maxGoalSteps, goal.steps.length);
    stats.stepsDone += done;
    stats.entries += goal._count.entries;
    if (!goal.doneAt) continue;
    stats.goalsDone += 1;
    if (goal.deadline && dayOf(goal.doneAt) <= goal.deadline) stats.goalsOnTime += 1;
    stats.longestGoalDays = Math.max(
      stats.longestGoalDays,
      differenceInCalendarDays(goal.doneAt, goal.createdAt),
    );
    if (goal.steps.length >= 5 && done === goal.steps.length) stats.perfectGoals += 1;
  }

  for (const task of teamTasks) {
    if (task.deadline && task.doneAt && dayOf(task.doneAt) <= task.deadline) {
      stats.teamOnTime += 1;
    }
  }

  return stats;
}

/**
 * Unlocks every achievement the user has earned and returns the codes
 * unlocked by this call (oldest first), plus the stats used.
 */
export async function syncAchievements(
  userId: string,
): Promise<{ newlyUnlocked: string[]; stats: Stats }> {
  const [stats, existing] = await Promise.all([
    computeStats(userId),
    prisma.achievementUnlock.findMany({ where: { userId }, select: { code: true } }),
  ]);
  const have = new Set(existing.map((row) => row.code));
  const newlyUnlocked = ACHIEVEMENTS.filter(
    (a) => !have.has(a.code) && stats[a.stat] >= a.target,
  ).map((a) => a.code);

  if (newlyUnlocked.length > 0) {
    // skipDuplicates: two quick actions may race to unlock the same achievement.
    await prisma.achievementUnlock.createMany({
      data: newlyUnlocked.map((code) => ({ userId, code })),
      skipDuplicates: true,
    });
  }
  return { newlyUnlocked, stats };
}
