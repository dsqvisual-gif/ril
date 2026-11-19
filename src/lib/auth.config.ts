import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isApp = path.startsWith("/app");
      const isAuthPage = path === "/login" || path === "/register";

      if (isApp) return isLoggedIn;
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/app", request.nextUrl));
      }
      return true;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
