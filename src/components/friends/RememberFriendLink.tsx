"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PENDING_FRIEND_COOKIE } from "@/lib/friend-link";

/** Remembers the friend link for a day, so the app can offer it after sign-in or sign-up. */
export function RememberFriendLink({ username, thenGo }: { username: string; thenGo?: string }) {
  const router = useRouter();
  useEffect(() => {
    document.cookie = `${PENDING_FRIEND_COOKIE}=${encodeURIComponent(username)}; path=/; max-age=86400; samesite=lax`;
    if (thenGo) router.replace(thenGo);
  }, [username, thenGo, router]);
  return thenGo ? <p style={{ padding: "2rem", textAlign: "center" }}>Открываю Uspeyka…</p> : null;
}
