"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { normalizeUsername, usernameError, usernameKey } from "@/lib/username";
import { usernameTakenError } from "@/lib/username-check";

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

  const taken = await usernameTakenError(username, userId);
  if (taken) return { error: taken };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { username, usernameKey: usernameKey(username) },
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
