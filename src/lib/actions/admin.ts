"use server";

import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";

async function adminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    throw new UserError("Нет доступа");
  }
  return session.user.id;
}

/**
 * Deletes an account and everything personal in it, freeing its email and
 * nickname for a new registration. Companies survive: an owner's company passes
 * to its oldest admin or member (or is deleted if nobody is left), and team
 * tasks the user created stay with the team.
 */
async function deleteUserInner(userId: string): Promise<void> {
  const me = await adminId();
  if (userId === me) throw new UserError("Свой аккаунт отсюда удалить нельзя");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) throw new UserError("Пользователь уже удалён");

  const memberships = await prisma.companyMember.findMany({
    where: { userId },
    select: { companyId: true, role: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const m of memberships) {
      let ownerId: string | null = null;
      if (m.role === "owner") {
        const successor = await tx.companyMember.findFirst({
          where: { companyId: m.companyId, status: "active", NOT: { userId } },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }], // "admin" sorts before "member"
          select: { id: true, userId: true },
        });
        if (!successor) {
          await tx.company.delete({ where: { id: m.companyId } });
          continue;
        }
        await tx.companyMember.update({ where: { id: successor.id }, data: { role: "owner" } });
        ownerId = successor.userId;
      } else {
        const owner = await tx.companyMember.findFirst({
          where: { companyId: m.companyId, role: "owner" },
          select: { userId: true },
        });
        ownerId = owner?.userId ?? null;
      }
      if (ownerId) {
        await tx.companyTask.updateMany({
          where: { companyId: m.companyId, creatorId: userId },
          data: { creatorId: ownerId },
        });
      }
    }

    await tx.emailCode.deleteMany({ where: { email: user.email } });
    // Tasks, goals, friendships, achievements and memberships go with the user (cascade).
    await tx.user.delete({ where: { id: userId } });
  });
}

export async function deleteUserAsAdmin(userId: string): Promise<ActionResult<void>> {
  return toResult(() => deleteUserInner(userId));
}
