"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isThemeId, THEME_COOKIE } from "@/lib/themes";

const YEAR = 60 * 60 * 24 * 365;

/** Saves the theme to the account (for other devices) and to a cookie (for this one). */
export async function saveTheme(theme: string): Promise<void> {
  if (!isThemeId(theme)) return;
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { theme } });
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

/** Puts the account's theme into this device's cookie (first visit from a new device). */
export async function syncThemeCookie(theme: string): Promise<void> {
  if (!isThemeId(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
}
