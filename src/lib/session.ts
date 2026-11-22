import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { mobileUserIdFromHeaders } from "@/lib/mobile-auth";

/**
 * The signed-in user: the website's session, or the mobile app's token
 * (Authorization: Bearer). The app calls the same actions as the website.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  const fromApp = await mobileUserIdFromHeaders(await headers());
  if (fromApp) return fromApp;
  redirect("/login");
}
