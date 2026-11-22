import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

/** The signed-in person's profile and settings, for the settings pages. */
export async function settingsUser() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      createdAt: true,
      theme: true,
      digestEnabled: true,
      momMode: true,
      healthEmails: true,
      image: true,
      avatarVersion: true,
      _count: { select: { reminders: true } },
    },
  });
  if (!user) notFound();
  return user;
}
