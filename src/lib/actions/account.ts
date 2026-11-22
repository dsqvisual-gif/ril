"use server";

import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { deleteAccount } from "@/lib/account-deletion";
import { rateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";

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

/** Changes the person's own display name. Friends see it unless they gave them their own name. */
export async function renameMe(raw: string): Promise<ActionResult<string>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const name = String(raw ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2) throw new UserError("Имя — минимум 2 символа");
    if (name.length > 80) throw new UserError("Имя длиннее 80 символов");
    if (!(await rateLimit(`rename:${userId}`, 20, 60 * 60))) {
      throw new UserError("Слишком часто. Попробуйте позже.");
    }
    await prisma.user.update({ where: { id: userId }, data: { name } });
    revalidatePath("/app", "layout");
    return name;
  });
}
