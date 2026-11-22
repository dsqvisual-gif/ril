/** What an avatar is drawn from: an uploaded photo, else the Google/Apple picture. */
export type AvatarSource = { id: string; image: string | null; avatarVersion: number };

export const AVATAR_SELECT = { id: true, image: true, avatarVersion: true } as const;

export const AVATAR_SIZE = 256;
export const AVATAR_MAX_BYTES = 200_000;

/** URL of the person's photo, or null to show their initial instead. */
export function avatarSrc(user: AvatarSource): string | null {
  if (user.avatarVersion > 0) return `/api/avatar/${user.id}?v=${user.avatarVersion}`;
  return user.image || null;
}
