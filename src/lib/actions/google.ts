"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

export async function googleSignInAction(formData: FormData) {
  const from = String(formData.get("from") ?? "/login");
  const back = from === "/register" ? "/register" : "/login";

  const clientId = process.env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
  if (!clientId || !clientSecret) {
    redirect(`${back}?error=google`);
  }

  await signIn("google", { redirectTo: "/app" });
}

export async function appleSignInAction(formData: FormData) {
  const from = String(formData.get("from") ?? "/login");
  const back = from === "/register" ? "/register" : "/login";

  if (!process.env.AUTH_APPLE_ID?.trim() || !process.env.AUTH_APPLE_SECRET?.trim()) {
    redirect(`${back}?error=apple`);
  }

  await signIn("apple", { redirectTo: "/app" });
}
