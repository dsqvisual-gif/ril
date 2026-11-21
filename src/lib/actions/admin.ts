"use server";

import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { deleteAccount } from "@/lib/account-deletion";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";

async function adminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    throw new UserError("Нет доступа");
  }
  return session.user.id;
}

async function deleteUserInner(userId: string): Promise<void> {
  const me = await adminId();
  if (userId === me) throw new UserError("Свой аккаунт отсюда удалить нельзя");
  if (!(await deleteAccount(userId))) throw new UserError("Пользователь уже удалён");
}

export async function deleteUserAsAdmin(userId: string): Promise<ActionResult<void>> {
  return toResult(() => deleteUserInner(userId));
}
