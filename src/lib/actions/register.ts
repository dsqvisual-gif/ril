"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { normalizeUsername, usernameError } from "@/lib/username";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type RegisterState = {
  error?: string;
};

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");

  if (!name || name.length < 2) {
    return { error: "Укажите имя (минимум 2 символа)" };
  }
  const nickError = usernameError(username);
  if (nickError) return { error: nickError };
  if (!email || !email.includes("@")) {
    return { error: "Укажите корректный email" };
  }
  if (password.length < 6) {
    return { error: "Пароль должен быть не короче 6 символов" };
  }

  if (!(await rateLimit(`register:ip:${clientIp(await headers())}`, 5, 60 * 60))) {
    return { error: "Слишком много регистраций. Попробуйте через час." };
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return { error: "Пользователь с таким email уже есть" };
  }

  const existingNick = await prisma.user.findUnique({ where: { username } });
  if (existingNick) {
    return { error: "Такой ник уже занят" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: { name, username, email, passwordHash },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Такой email или ник уже занят" };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      login: email,
      password,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Аккаунт создан, но вход не удался. Попробуйте войти." };
    }
    throw error;
  }

  return {};
}
