"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { EmailCodeRejected, signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendCodeEmail, type CodePurpose } from "@/lib/email";
import {
  codeErrorText,
  consumeCode,
  isEmail,
  issueCode,
  normalizeEmail,
} from "@/lib/email-codes";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeUsername, usernameError } from "@/lib/username";
import { usernameTakenError } from "@/lib/username-check";

export type CodeFlowState = {
  error?: string;
  /** Set once a code was sent: the form switches to entering it. */
  email?: string;
  notice?: string;
};

const PASSWORD_MIN = 6;

async function allowSend(email: string): Promise<boolean> {
  const ip = clientIp(await headers());
  return (
    (await rateLimit(`code:ip:${ip}`, 20, 60 * 60)) &&
    (await rateLimit(`code:email:${email}`, 5, 60 * 60))
  );
}

async function deliver(email: string, purpose: CodePurpose, code: string): Promise<string | null> {
  try {
    await sendCodeEmail(email, purpose, code);
    return null;
  } catch (error) {
    console.error("sending code failed", error);
    return "Не удалось отправить письмо. Попробуйте через пару минут.";
  }
}

function rejectedText(error: unknown): string | null {
  if (error instanceof EmailCodeRejected) {
    if (error.code === "taken") return "Этот email или ник уже заняли. Начните заново.";
    if (error.code === "no_user") return "Аккаунт с этим email не найден";
    return codeErrorText(error.code as Parameters<typeof codeErrorText>[0]);
  }
  if (error instanceof AuthError) return "Не удалось войти. Попробуйте ещё раз.";
  return null;
}

// ---------- registration ----------

export async function startRegistration(
  _prev: CodeFlowState,
  formData: FormData,
): Promise<CodeFlowState> {
  const name = String(formData.get("name") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: "Укажите имя (минимум 2 символа)" };
  if (name.length > 80) return { error: "Имя длиннее 80 символов" };
  const nickError = usernameError(username);
  if (nickError) return { error: nickError };
  if (!isEmail(email)) return { error: "Укажите корректный email" };
  if (password.length < PASSWORD_MIN) {
    return { error: `Пароль должен быть не короче ${PASSWORD_MIN} символов` };
  }

  if (formData.get("consent") !== "on") {
    return { error: "Чтобы зарегистрироваться, примите правила и согласие на обработку данных" };
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "Пользователь с таким email уже есть. Войдите или восстановите пароль." };
  }
  const nickTaken = await usernameTakenError(username);
  if (nickTaken) return { error: nickTaken };

  if (!(await allowSend(email))) {
    return { error: "Слишком много писем. Попробуйте через час." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const code = await issueCode(email, "register", { name, username, passwordHash });
  const failed = await deliver(email, "register", code);
  if (failed) return { error: failed };
  return { email };
}

export async function confirmRegistration(
  _prev: CodeFlowState,
  formData: FormData,
): Promise<CodeFlowState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "");
  try {
    await signIn("email-code", { email, code, purpose: "register", redirectTo: "/app" });
  } catch (error) {
    const message = rejectedText(error);
    if (message) return { email, error: message };
    throw error;
  }
  return { email };
}

// ---------- login by code ----------

export async function requestLoginCode(
  _prev: CodeFlowState,
  formData: FormData,
): Promise<CodeFlowState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isEmail(email)) return { error: "Укажите корректный email" };
  if (!(await allowSend(email))) return { error: "Слишком много писем. Попробуйте через час." };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { error: "Аккаунт с этим email не найден. Зарегистрируйтесь." };

  const failed = await deliver(email, "login", await issueCode(email, "login"));
  if (failed) return { error: failed };
  return { email };
}

export async function loginWithCode(
  _prev: CodeFlowState,
  formData: FormData,
): Promise<CodeFlowState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "");
  try {
    await signIn("email-code", { email, code, purpose: "login", redirectTo: "/app" });
  } catch (error) {
    const message = rejectedText(error);
    if (message) return { email, error: message };
    throw error;
  }
  return { email };
}

// ---------- password reset ----------

export async function requestResetCode(
  _prev: CodeFlowState,
  formData: FormData,
): Promise<CodeFlowState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isEmail(email)) return { error: "Укажите корректный email" };
  if (!(await allowSend(email))) return { error: "Слишком много писем. Попробуйте через час." };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { error: "Аккаунт с этим email не найден" };

  const failed = await deliver(email, "reset", await issueCode(email, "reset"));
  if (failed) return { error: failed };
  return { email };
}

export async function resetPassword(
  _prev: CodeFlowState,
  formData: FormData,
): Promise<CodeFlowState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < PASSWORD_MIN) {
    return { email, error: `Пароль должен быть не короче ${PASSWORD_MIN} символов` };
  }

  const check = await consumeCode(email, "reset", code);
  if (!check.ok) return { email, error: codeErrorText(check.reason) };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { email, error: "Аккаунт с этим email не найден" };
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10), emailVerified: new Date() },
  });

  try {
    await signIn("credentials", { login: email, password, redirectTo: "/app" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { notice: "Пароль изменён. Войдите с новым паролем." };
    }
    throw error;
  }
  return {};
}

// ---------- resend ----------

/** Sends a new code for a flow already in progress (registration keeps its pending account). */
export async function resendCode(
  rawEmail: string,
  purpose: CodePurpose,
): Promise<{ error?: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return { error: "Укажите корректный email" };
  if (!(await allowSend(email))) return { error: "Слишком много писем. Попробуйте через час." };

  let payload = undefined;
  if (purpose === "register") {
    const pending = await prisma.emailCode.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    });
    if (!pending?.payload) return { error: "Начните регистрацию заново" };
    payload = pending.payload;
  } else {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return { error: "Аккаунт с этим email не найден" };
  }

  const failed = await deliver(email, purpose, await issueCode(email, purpose, payload ?? undefined));
  return failed ? { error: failed } : {};
}
