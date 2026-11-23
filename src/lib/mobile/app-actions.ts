import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import { isThemeId } from "@/lib/themes";
import { normalizeUsername, usernameError, usernameKey } from "@/lib/username";
import { usernameTakenError } from "@/lib/username-check";
import { deleteAccount } from "@/lib/account-deletion";
import { rateLimit } from "@/lib/rate-limit";
import { mobileUser, type MobileUser } from "@/lib/mobile-auth";

/**
 * Account actions for the app. On the website these go through forms and cookies;
 * here they take plain arguments and return the fresh profile.
 */

async function me(userId: string): Promise<MobileUser> {
  const user = await mobileUser(userId);
  if (!user) throw new UserError("Аккаунт не найден");
  return user;
}

export async function profile(): Promise<ActionResult<MobileUser & { digestEnabled: boolean }>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { digestEnabled: true } });
    return { ...(await me(userId)), digestEnabled: row.digestEnabled };
  });
}

export async function setTheme(theme: string): Promise<ActionResult<MobileUser>> {
  return toResult(async () => {
    const userId = await requireUserId();
    if (!isThemeId(theme)) throw new UserError("Неизвестная тема");
    await prisma.user.update({ where: { id: userId }, data: { theme } });
    return me(userId);
  });
}

export async function setUsername(raw: string): Promise<ActionResult<MobileUser>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const username = normalizeUsername(String(raw ?? ""));
    const error = usernameError(username);
    if (error) throw new UserError(error);
    const taken = await usernameTakenError(username, userId);
    if (taken) throw new UserError(taken);
    try {
      await prisma.user.update({ where: { id: userId }, data: { username, usernameKey: usernameKey(username) } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new UserError("Такой ник уже занят");
      }
      throw err;
    }
    return me(userId);
  });
}

export async function setMomMode(on: boolean): Promise<ActionResult<MobileUser>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await prisma.user.update({ where: { id: userId }, data: { momMode: Boolean(on) } });
    return me(userId);
  });
}

/** Deleting the account from the app, confirmed by typing the nickname (or e-mail). */
export async function deleteMe(confirm: string): Promise<ActionResult<true>> {
  return toResult(async () => {
    const userId = await requireUserId();
    if (!(await rateLimit(`delete-account:${userId}`, 5, 15 * 60))) {
      throw new UserError("Слишком много попыток. Подождите 15 минут.");
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, email: true } });
    if (!user) throw new UserError("Аккаунт уже удалён");
    const typed = String(confirm ?? "").trim().toLowerCase().replace(/^@/, "");
    const expected = (user.username ?? user.email).toLowerCase();
    if (typed !== expected) {
      throw new UserError(`Чтобы подтвердить, введите ${user.username ? `свой ник @${user.username}` : "свою почту"}`);
    }
    await deleteAccount(userId);
    return true as const;
  });
}
