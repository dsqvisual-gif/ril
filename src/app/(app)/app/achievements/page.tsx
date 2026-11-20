import type { Metadata } from "next";
import { AchievementGrid } from "@/components/AchievementGrid";
import { syncAchievements } from "@/lib/achievement-stats";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Достижения — Uspeyka",
};

export default async function AchievementsPage() {
  const userId = await requireUserId();
  // Also unlocks anything earned before these achievements existed.
  const { stats } = await syncAchievements(userId);
  const unlocks = await prisma.achievementUnlock.findMany({
    where: { userId },
    select: { code: true, unlockedAt: true },
  });

  return (
    <AchievementGrid
      stats={stats}
      unlocked={unlocks.map((u) => ({ code: u.code, at: u.unlockedAt.toISOString() }))}
    />
  );
}
