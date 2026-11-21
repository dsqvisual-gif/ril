import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";

/** Emails allowed into /app/admin, from the ADMIN_EMAILS variable (comma-separated). */
function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().has(email!.toLowerCase());
}

/** Lets admins through; for everyone else the admin pages do not exist. */
export async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) notFound();
}
