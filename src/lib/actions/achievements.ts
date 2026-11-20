"use server";

import { requireUserId } from "@/lib/session";
import { syncAchievements } from "@/lib/achievement-stats";

/**
 * Unlocks whatever the user has earned since the last check and returns the
 * new codes. Pages call it after goal, team and friend actions.
 */
export async function claimAchievements(): Promise<string[]> {
  const userId = await requireUserId();
  try {
    return (await syncAchievements(userId)).newlyUnlocked;
  } catch (error) {
    console.error(error);
    return [];
  }
}
