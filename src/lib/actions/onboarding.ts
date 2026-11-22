"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

/** The tour was finished or skipped: do not show it again. */
export async function finishOnboarding(): Promise<void> {
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });
}

/** "Show the tour again" from the profile. */
export async function replayOnboarding(): Promise<void> {
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { onboardedAt: null } });
  // The tour lives in the app layout, which client navigation would otherwise keep as is.
  revalidatePath("/app", "layout");
  redirect("/app");
}
