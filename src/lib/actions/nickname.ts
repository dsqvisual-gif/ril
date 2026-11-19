"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { normalizeUsername, usernameError } from "@/lib/username";

export type NicknameState = {
  error?: string;
  ok?: boolean;
};

export async function setUsernameAction(
  _prev: NicknameState,
  formData: FormData,
): Promise<NicknameState> {
  const userId = await requireUserId();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const error = usernameError(username);
  if (error) return { error };

  const taken = await prisma.user.findFirst({
    where: { username, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) return { error: "Такой ник уже занят" };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { username },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Такой ник уже занят" };
    }
    throw err;
  }

  revalidatePath("/app");
  return { ok: true };
}
