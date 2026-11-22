import { SITE_URL } from "@/lib/site";

/** Cookie that remembers whose friend link was opened before signing in. */
export const PENDING_FRIEND_COOKIE = "uspeyka-add-friend";

export function friendLink(username: string): string {
  return `${SITE_URL}/add/${encodeURIComponent(username)}`;
}
