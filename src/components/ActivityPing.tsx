"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pingActivity } from "@/lib/actions/activity";
import { describeUnlocked } from "@/lib/achievements";
import { AchievementToast } from "./AchievementToast";

const EVERY_MS = 60_000;

/**
 * Reports a minute of use while the app is open and visible, and shows
 * achievements earned for coming back (daily streaks, time with us).
 */
export function ActivityPing() {
  const router = useRouter();
  const [award, setAward] = useState<{ icon: string; title: string } | null>(null);
  const close = useCallback(() => setAward(null), []);

  useEffect(() => {
    let stopped = false;

    async function ping() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        // The account was deleted: end the session.
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const result = await pingActivity(zone);
        if (!result.alive) {
          router.replace("/goodbye");
          return;
        }
        const unlocked = describeUnlocked(result.unlocked);
        if (unlocked) setAward(unlocked);
      } catch {
        // Offline or a deploy in progress: the next ping will catch up.
      }
    }

    void ping();
    const timer = setInterval(() => void ping(), EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return award ? <AchievementToast icon={award.icon} title={award.title} onClose={close} /> : null;
}
