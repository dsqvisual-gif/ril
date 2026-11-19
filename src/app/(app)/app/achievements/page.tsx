import { AchievementGrid } from "@/components/AchievementGrid";
import { completedTaskCount } from "@/lib/actions/tasks";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function AchievementsPage() {
  const userId = await requireUserId();

  const [completedCount, unlocks] = await Promise.all([
    completedTaskCount(),
    prisma.achievementUnlock.findMany({
      where: { userId },
      select: { code: true },
    }),
  ]);

  return (
    <AchievementGrid
      completedCount={completedCount}
      unlockedCodes={unlocks.map((u) => u.code)}
    />
  );
}
