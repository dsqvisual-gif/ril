"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Pings closer than this are ignored, so each counted ping is about one minute of use. */
const MIN_GAP_MS = 50_000;

function almatyDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(date);
}

/**
 * Called by the app about once a minute while its tab is visible: adds a minute
 * of use, counts a new active day and stamps the last visit.
 * Returns false when the account no longer exists.
 */
export async function pingActivity(): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastSeenAt: true },
  });
  if (!user) return false;

  const now = new Date();
  if (user.lastSeenAt && now.getTime() - user.lastSeenAt.getTime() < MIN_GAP_MS) return true;
  const newDay = !user.lastSeenAt || almatyDay(user.lastSeenAt) !== almatyDay(now);

  await prisma.user.update({
    where: { id: userId },
    data: {
      lastSeenAt: now,
      activeMinutes: { increment: 1 },
      ...(newDay ? { activeDays: { increment: 1 } } : {}),
    },
  });
  return true;
}
