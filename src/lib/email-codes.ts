import { createHash, randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CodePurpose } from "@/lib/email";

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(email: string, purpose: CodePurpose, code: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${secret}:${purpose}:${email}:${code}`).digest("hex");
}

export function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/** Creates a fresh 6-digit code (older ones for the same email and purpose stop working). */
export async function issueCode(
  email: string,
  purpose: CodePurpose,
  payload?: Prisma.InputJsonValue,
): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$transaction([
    prisma.emailCode.deleteMany({
      where: { OR: [{ email, purpose }, { expiresAt: { lt: new Date() } }] },
    }),
    prisma.emailCode.create({
      data: {
        email,
        purpose,
        codeHash: hashCode(email, purpose, code),
        payload,
        expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
      },
    }),
  ]);
  return code;
}

export type CodeCheck =
  | { ok: true; payload: Prisma.JsonValue | null }
  | { ok: false; reason: "missing" | "expired" | "wrong" | "locked" };

/** Checks a code and uses it up on success. Each wrong try counts toward a limit. */
export async function consumeCode(
  email: string,
  purpose: CodePurpose,
  rawCode: string,
): Promise<CodeCheck> {
  const code = rawCode.replace(/\D/g, "");
  const row = await prisma.emailCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, reason: "missing" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  if (code.length !== 6 || row.codeHash !== hashCode(email, purpose, code)) {
    await prisma.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: row.attempts + 1 >= MAX_ATTEMPTS ? "locked" : "wrong" };
  }

  // deleteMany so two parallel submits cannot both use one code.
  const used = await prisma.emailCode.deleteMany({ where: { id: row.id } });
  if (used.count === 0) return { ok: false, reason: "missing" };
  return { ok: true, payload: row.payload };
}

export function codeErrorText(reason: Exclude<CodeCheck, { ok: true }>["reason"]): string {
  switch (reason) {
    case "expired":
      return "Код устарел. Отправьте новый.";
    case "locked":
      return "Слишком много неверных попыток. Отправьте новый код.";
    case "missing":
      return "Код не найден. Отправьте новый.";
    default:
      return "Неверный код";
  }
}
