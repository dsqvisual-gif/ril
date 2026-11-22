import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { isAppReturnUrl, RETURN_COOKIE } from "@/lib/mobile-auth";

const PAGES: Record<string, string> = {
  login: "/login",
  register: "/register",
  code: "/login/code",
  forgot: "/forgot",
};

/**
 * The app opens this in the phone's browser to sign in on the website (Google,
 * or any web form). The return address is remembered for /mobile/finish.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = url.searchParams.get("return");
  if (!isAppReturnUrl(back)) return new Response("Неверный адрес возврата", { status: 400 });

  (await cookies()).set(RETURN_COOKIE, back, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  if ((await auth())?.user?.id) redirect("/mobile/finish");

  const to = url.searchParams.get("to") ?? "google";
  if (to === "google") {
    if (!process.env.AUTH_GOOGLE_ID?.trim() || !process.env.AUTH_GOOGLE_SECRET?.trim()) {
      redirect(`/mobile/finish?error=google`);
    }
    await signIn("google", { redirectTo: "/mobile/finish" });
  }
  redirect(PAGES[to] ?? "/login");
}
