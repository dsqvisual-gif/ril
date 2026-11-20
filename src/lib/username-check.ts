import { prisma } from "@/lib/prisma";
import { usernameKey } from "@/lib/username";

// Accounts created before nickname keys existed get theirs on first check.
async function backfillKeys(): Promise<void> {
  const missing = await prisma.user.findMany({
    where: { username: { not: null }, usernameKey: null },
    select: { id: true, username: true },
    take: 500,
  });
  await Promise.all(
    missing.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: { usernameKey: usernameKey(user.username!) },
      }),
    ),
  );
}

/**
 * Error text when `username` is taken or looks like someone else's nickname;
 * null when it is free. `exceptUserId` skips the user's own account.
 */
export async function usernameTakenError(
  username: string,
  exceptUserId?: string,
): Promise<string | null> {
  await backfillKeys();
  const clash = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { usernameKey: usernameKey(username) }],
      ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}),
    },
    select: { username: true },
  });
  if (!clash) return null;
  if (clash.username === username) return "Такой ник уже занят";
  return `Ник слишком похож на @${clash.username} — выберите другой, чтобы вас не путали`;
}
