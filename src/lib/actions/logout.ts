"use server";

import { signOut } from "@/lib/auth";

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

/** Clears the session cookie without leaving the current page. */
export async function endSession() {
  await signOut({ redirect: false });
}
