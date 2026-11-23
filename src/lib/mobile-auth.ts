import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { avatarSrc } from "@/lib/avatar";
import { SITE_URL } from "@/lib/site";

/**
 * Sign-in for the mobile app. The app gets a long-lived token signed with
 * AUTH_SECRET and sends it as "Authorization: Bearer …". It is checked against
 * the database on every request, so a deleted account loses access at once.
 */

const AUDIENCE = "uspeyka-mobile";
const TOKEN_DAYS = 180;
const HANDOFF_MINUTES = 5;

/** Where the browser version of the app runs; native apps send no Origin. */
const WEB_ORIGINS = new Set(["https://danil.expo.app", "http://localhost:8081"]);

/** Return addresses allowed after a sign-in on the website. */
export function isAppReturnUrl(raw: string | null): raw is string {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol === "uspeyka:" || url.protocol === "exp:" || url.protocol === "exps:") return true;
    return WEB_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signMobileToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_DAYS}d`)
    .sign(secret());
}

/** The signed-in user of a request from the app, or null. */
export async function mobileUserId(request: Request): Promise<string | null> {
  return mobileUserIdFromHeaders(request.headers);
}

/** Same, from the request headers (used where only next/headers is available). */
export async function mobileUserIdFromHeaders(headers: Headers): Promise<string | null> {
  const header = headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE });
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export type MobileUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatar: string | null;
  momMode: boolean;
  /** Colour theme chosen on the site or in the app (src/lib/themes.ts), or null. */
  theme: string | null;
};

export async function mobileUser(userId: string): Promise<MobileUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, email: true, image: true, avatarVersion: true, momMode: true, theme: true },
  });
  if (!user) return null;
  const avatar = avatarSrc(user);
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    // Uploaded photos live on our site; make the address absolute for the app.
    avatar: avatar && avatar.startsWith("/") ? `${SITE_URL}${avatar}` : avatar,
    momMode: user.momMode,
    theme: user.theme,
  };
}

/** A token and the profile, as the app receives them after any sign-in. */
export async function sessionFor(userId: string) {
  return { token: await signMobileToken(userId), user: await mobileUser(userId) };
}

function hash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** A one-time code the website hands back to the app after signing in there. */
export async function createHandoffCode(userId: string): Promise<string> {
  const code = randomBytes(24).toString("base64url");
  await prisma.mobileAuthCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.mobileAuthCode.create({
    data: { codeHash: hash(code), userId, expiresAt: new Date(Date.now() + HANDOFF_MINUTES * 60_000) },
  });
  return code;
}

/** Trades a handoff code for its user; each code works once. */
export async function redeemHandoffCode(code: string): Promise<string | null> {
  if (!code || code.length > 100) return null;
  const row = await prisma.mobileAuthCode.findUnique({ where: { codeHash: hash(code) } });
  if (!row) return null;
  await prisma.mobileAuthCode.delete({ where: { id: row.id } });
  return row.expiresAt > new Date() ? row.userId : null;
}

/** CORS for the browser version of the app. */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !WEB_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function mobileJson(request: Request, data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: corsHeaders(request) });
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export const RETURN_COOKIE = "uspeyka-mobile-return";
