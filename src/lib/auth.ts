import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { consumeCode, normalizeEmail, type CodeCheck } from "@/lib/email-codes";
import { usernameKey } from "@/lib/username";

export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

/** A one-time email code was not accepted; `code` holds the reason. */
export class EmailCodeRejected extends CredentialsSignin {
  constructor(reason: Exclude<CodeCheck, { ok: true }>["reason"] | "taken" | "no_user") {
    super();
    this.code = reason;
  }
}

type PendingAccount = { name: string; username: string; passwordHash: string };

function pendingAccount(payload: unknown): PendingAccount | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.name !== "string" || typeof p.username !== "string") return null;
  if (typeof p.passwordHash !== "string") return null;
  return { name: p.name, username: p.username, passwordHash: p.passwordHash };
}

/** Signs in with a code from email: finishes a registration or logs into an account. */
async function authorizeEmailCode(credentials: Partial<Record<string, unknown>> | undefined) {
  const email = typeof credentials?.email === "string" ? normalizeEmail(credentials.email) : "";
  const code = typeof credentials?.code === "string" ? credentials.code : "";
  const purpose = credentials?.purpose === "register" ? "register" : "login";
  if (!email || !code) return null;

  const check = await consumeCode(email, purpose, code);
  if (!check.ok) throw new EmailCodeRejected(check.reason);

  if (purpose === "register") {
    const pending = pendingAccount(check.payload);
    if (!pending) throw new EmailCodeRejected("missing");
    const clash = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: pending.username },
          { usernameKey: usernameKey(pending.username) },
        ],
      },
      select: { id: true },
    });
    if (clash) throw new EmailCodeRejected("taken");
    const user = await prisma.user.create({
      data: {
        email,
        name: pending.name,
        username: pending.username,
        usernameKey: usernameKey(pending.username),
        passwordHash: pending.passwordHash,
        emailVerified: new Date(),
      },
    });
    return { id: user.id, email: user.email, name: user.name, username: user.username };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new EmailCodeRejected("no_user");
  if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }
  return { id: user.id, email: user.email, name: user.name, username: user.username };
}

function googleProfile(profile: unknown): {
  email: string;
  name: string;
  image: string | null;
} | null {
  if (!profile || typeof profile !== "object") return null;
  const raw = profile as {
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
    picture?: unknown;
  };
  if (typeof raw.email !== "string" || !raw.email.includes("@")) return null;
  // Accounts are linked by email, so only a verified Google email may claim one.
  if (raw.email_verified !== true) return null;
  const email = raw.email.toLowerCase().trim();
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : email.split("@")[0];
  const image = typeof raw.picture === "string" ? raw.picture : null;
  return { email, name, image };
}

/** Apple sends a name only on the very first sign-in, so the email may have to stand in. */
function appleProfile(
  profile: unknown,
  fallbackName: string | null | undefined,
): { email: string; name: string; image: null } | null {
  if (!profile || typeof profile !== "object") return null;
  const raw = profile as { email?: unknown; email_verified?: unknown };
  if (typeof raw.email !== "string" || !raw.email.includes("@")) return null;
  if (raw.email_verified !== true && raw.email_verified !== "true") return null;
  const email = raw.email.toLowerCase().trim();
  const name = fallbackName?.trim() || email.split("@")[0];
  return { email, name, image: null };
}

async function upsertOAuthUser(input: {
  email: string;
  name: string;
  image: string | null;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Google only signs in verified emails, so this also proves ownership.
    const imageChanged = Boolean(input.image) && input.image !== existing.image;
    if (imageChanged || !existing.emailVerified) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(imageChanged ? { image: input.image } : {}),
          emailVerified: existing.emailVerified ?? new Date(),
        },
      });
    }
    return existing;
  }

  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name.slice(0, 80),
      image: input.image,
      emailVerified: new Date(),
    },
  });
}

function appleEnv() {
  const clientId = process.env.AUTH_APPLE_ID?.trim();
  const clientSecret = process.env.AUTH_APPLE_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

const apple = appleEnv();

/** Which social sign-ins are configured, for showing their buttons. */
export const socialProviders = { google: Boolean(googleEnv()), apple: Boolean(apple) };

function googleEnv() {
  const clientId = process.env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

const google = googleEnv();

function preferRequestHost() {
  if (process.env.VERCEL !== "1") return;
  for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
    const value = process.env[key];
    if (!value) continue;
    try {
      const host = new URL(value).hostname;
      if (host === "localhost" || host === "127.0.0.1") delete process.env[key];
    } catch {
      delete process.env[key];
    }
  }
}

preferRequestHost();

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        login: { label: "Email или ник", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials, request) {
        const login = credentials?.login;
        const password = credentials?.password;

        if (typeof login !== "string" || typeof password !== "string" || !login || !password) {
          return null;
        }

        const key = login.toLowerCase().trim();
        const allowed =
          (await rateLimit(`login:ip:${clientIp(request.headers)}`, 30, 15 * 60)) &&
          (await rateLimit(`login:acct:${key}`, 10, 15 * 60));
        if (!allowed) throw new LoginRateLimited();

        const user = await prisma.user.findFirst({
          where: key.includes("@") ? { email: key } : { username: key },
        });

        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
        };
      },
    }),
    Credentials({
      id: "email-code",
      name: "Код из письма",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Код", type: "text" },
        purpose: { label: "Цель", type: "text" },
      },
      authorize: authorizeEmailCode,
    }),
    ...(google
      ? [
          Google({
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(apple
      ? [
          Apple({
            clientId: apple.clientId,
            clientSecret: apple.clientSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        return Boolean(googleProfile(profile));
      }
      if (account?.provider === "apple") {
        return Boolean(appleProfile(profile, null));
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" || account?.provider === "apple") {
        const parsed =
          account.provider === "google" ? googleProfile(profile) : appleProfile(profile, user?.name);
        const email =
          parsed?.email ??
          (typeof user?.email === "string" ? user.email.toLowerCase() : "");
        if (email) {
          const dbUser = await upsertOAuthUser({
            email,
            name: parsed?.name || user?.name || email.split("@")[0],
            image: parsed?.image ?? user?.image ?? null,
          });
          token.id = dbUser.id;
          token.username = dbUser.username;
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.picture = dbUser.image;
          return token;
        }
      }

      if (user?.id) {
        token.id = user.id;
      }

      // Refresh from the DB on sign-in and until a nickname is chosen,
      // not on every request.
      if (typeof token.id === "string" && (user || !token.username)) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.id } });
        if (dbUser) {
          token.username = dbUser.username;
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.picture = dbUser.image;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.username = (token.username as string | null | undefined) ?? null;
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
      }
      return session;
    },
  },
});
