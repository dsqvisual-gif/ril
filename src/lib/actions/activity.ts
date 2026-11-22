"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shiftDateKey } from "@/lib/dates";
import { almatyDay, syncAchievements } from "@/lib/achievement-stats";

/** Pings closer than this are ignored, so each counted ping is about one minute of use. */
const MIN_GAP_MS = 50_000;

function validTimeZone(zone: string): boolean {
  if (zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Called by the app about once a minute while its tab is visible: adds a minute
 * of use, counts a new active day and stamps the last visit.
 * `alive` is false when the account no longer exists; `unlocked` lists
 * achievements earned by coming back on a new day.
 */
export type PingResult = { alive: boolean; unlocked: string[] };

export async function pingActivity(timeZone?: string): Promise<PingResult> {
  const quiet = { alive: true, unlocked: [] };
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return quiet;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastSeenAt: true,
      timeZone: true,
      lastActiveOn: true,
      useStreak: true,
      bestUseStreak: true,
    },
  });
  if (!user) return { alive: false, unlocked: [] };

  // Remember the browser's time zone, so morning emails know when "today" is.
  if (timeZone && timeZone !== user.timeZone && validTimeZone(timeZone)) {
    await prisma.user.update({ where: { id: userId }, data: { timeZone } });
  }

  const now = new Date();
  const today = almatyDay(now);
  // A streak is counted once a day, even when the minute counter skips a ping.
  const streakDay = user.lastActiveOn !== today;
  if (!streakDay && user.lastSeenAt && now.getTime() - user.lastSeenAt.getTime() < MIN_GAP_MS) {
    return quiet;
  }
  const newDay = !user.lastSeenAt || almatyDay(user.lastSeenAt) !== today;
  const streak = user.lastActiveOn === shiftDateKey(today, -1) ? user.useStreak + 1 : 1;

  await prisma.user.update({
    where: { id: userId },
    data: {
      lastSeenAt: now,
      activeMinutes: { increment: 1 },
      ...(newDay ? { activeDays: { increment: 1 } } : {}),
      ...(streakDay
        ? {
            lastActiveOn: today,
            useStreak: streak,
            bestUseStreak: Math.max(user.bestUseStreak, streak),
          }
        : {}),
    },
  });

  if (!streakDay) return quiet;
  try {
    return { alive: true, unlocked: (await syncAchievements(userId)).newlyUnlocked };
  } catch (error) {
    console.error(error);
    return quiet;
  }
}
