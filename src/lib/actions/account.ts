"use server";

import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { deleteAccount } from "@/lib/account-deletion";
import { rateLimit } from "@/lib/rate-limit";

export type DeleteAccountState = { error?: string };

/** The user deletes their own account after typing their nickname to confirm. */
export async function deleteMyAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const userId = await requireUserId();
  if (!(await rateLimit(`delete-account:${userId}`, 5, 15 * 60))) {
    return { error: "Слишком много попыток. Подождите 15 минут." };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true },
  });
  if (!user) return { error: "Аккаунт уже удалён" };

  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase().replace(/^@/, "");
  const expected = (user.username ?? user.email).toLowerCase();
  if (typed !== expected) {
    return { error: `Чтобы подтвердить, введите ${user.username ? `свой ник @${user.username}` : "свою почту"}` };
  }

  await deleteAccount(userId);
  await signOut({ redirectTo: "/goodbye" });
  return {};
}
