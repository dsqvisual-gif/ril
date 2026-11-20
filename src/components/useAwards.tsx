"use client";

import { useCallback, useState } from "react";
import { claimAchievements } from "@/lib/actions/achievements";
import { describeUnlocked } from "@/lib/achievements";
import { AchievementToast } from "./AchievementToast";

/**
 * Checks for newly earned achievements after an action and shows a toast.
 * `claim` is fire-and-forget; `toast` renders the latest award.
 */
export function useAwards() {
  const [award, setAward] = useState<{ icon: string; title: string } | null>(null);

  const claim = useCallback(() => {
    void claimAchievements()
      .then((codes) => {
        const unlocked = describeUnlocked(codes);
        if (unlocked) setAward(unlocked);
      })
      .catch(() => {});
  }, []);

  const close = useCallback(() => setAward(null), []);

  const toast = award ? (
    <AchievementToast icon={award.icon} title={award.title} onClose={close} />
  ) : null;

  return { claim, toast };
}
