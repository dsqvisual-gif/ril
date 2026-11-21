"use server";

import { LoginRateLimited, signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError } from "next-auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const login = String(formData.get("login") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    return { error: "Введите email или ник и пароль" };
  }

  const user = await prisma.user.findFirst({
    where: login.includes("@") ? { email: login } : { username: login },
    select: { passwordHash: true },
  });

  if (user && !user.passwordHash) {
    return { error: "У этого аккаунта нет пароля — войдите через Google или по коду из письма" };
  }

  try {
    await signIn("credentials", {
      login,
      password,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof LoginRateLimited) {
      return { error: "Слишком много попыток входа. Подождите 15 минут." };
    }
    if (error instanceof AuthError) {
      return { error: "Неверный email, ник или пароль" };
    }
    throw error;
  }

  return {};
}
