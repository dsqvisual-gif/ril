"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import { AVATAR_MAX_BYTES, AVATAR_SELECT, avatarSrc } from "@/lib/avatar";

const PREFIX = "data:image/jpeg;base64,";

/** Saves a photo the browser already cropped and shrank to a small JPEG. */
async function setAvatarInner(dataUrl: string): Promise<string | null> {
  const userId = await requireUserId();
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PREFIX)) {
    throw new UserError("Не удалось прочитать фото — попробуйте другое");
  }
  const bytes = Buffer.from(dataUrl.slice(PREFIX.length), "base64");
  if (bytes.length > AVATAR_MAX_BYTES) throw new UserError("Фото слишком большое");
  // A real JPEG starts with FF D8 FF.
  if (bytes.length < 100 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new UserError("Не удалось прочитать фото — попробуйте другое");
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar: bytes, avatarVersion: { increment: 1 } },
    select: AVATAR_SELECT,
  });
  revalidatePath("/app", "layout");
  return avatarSrc(user);
}

async function removeAvatarInner(): Promise<string | null> {
  const userId = await requireUserId();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar: null, avatarVersion: 0 },
    select: AVATAR_SELECT,
  });
  revalidatePath("/app", "layout");
  return avatarSrc(user);
}

export async function setAvatar(dataUrl: string): Promise<ActionResult<string | null>> {
  return toResult(() => setAvatarInner(dataUrl));
}

export async function removeAvatar(): Promise<ActionResult<string | null>> {
  return toResult(() => removeAvatarInner());
}
