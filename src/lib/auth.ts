import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

function googleProfile(profile: unknown): {
  email: string;
  name: string;
  image: string | null;
} | null {
  if (!profile || typeof profile !== "object") return null;
  const raw = profile as { email?: unknown; name?: unknown; picture?: unknown };
  if (typeof raw.email !== "string" || !raw.email.includes("@")) return null;
  const email = raw.email.toLowerCase().trim();
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : email.split("@")[0];
  const image = typeof raw.picture === "string" ? raw.picture : null;
  return { email, name, image };
}

async function upsertGoogleUser(input: {
  email: string;
  name: string;
  image: string | null;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (input.image && input.image !== existing.image) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { image: input.image },
      });
    }
    return existing;
  }

  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name.slice(0, 80),
      image: input.image,
    },
  });
}

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
      async authorize(credentials) {
        const login = credentials?.login;
        const password = credentials?.password;

        if (typeof login !== "string" || typeof password !== "string" || !login || !password) {
          return null;
        }

        const key = login.toLowerCase().trim();
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
    ...(google
      ? [
          Google({
            clientId: google.clientId,
            clientSecret: google.clientSecret,
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
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        const parsed = googleProfile(profile);
        const email =
          parsed?.email ??
          (typeof user?.email === "string" ? user.email.toLowerCase() : "");
        if (email) {
          const dbUser = await upsertGoogleUser({
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

      if (typeof token.id === "string") {
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
