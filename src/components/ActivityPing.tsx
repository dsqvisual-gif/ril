"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pingActivity } from "@/lib/actions/activity";

const EVERY_MS = 60_000;

/** Reports a minute of use while the app is open and visible. */
export function ActivityPing() {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;

    async function ping() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        // The account was deleted: end the session.
        if (!(await pingActivity())) router.replace("/goodbye");
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

  return null;
}
