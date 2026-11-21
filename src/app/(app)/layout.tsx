import { AppHeader } from "@/components/AppHeader";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NicknameGate } from "@/components/NicknameGate";
import { suggestUsername } from "@/lib/username";
import { isAdminEmail } from "@/lib/admin";
import { ActivityPing } from "@/components/ActivityPing";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Name and nickname come from the session token; the JWT callback
  // re-reads them from the DB until a nickname is set.
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    redirect("/login");
  }
  // A deleted account can still hold a valid session cookie.
  const exists = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!exists) redirect("/goodbye");
  const name = user.name ?? "";

  return (
    <div className="app-shell">
      <ActivityPing />
      <AppHeader
        name={name}
        username={user.username ?? null}
        isAdmin={isAdminEmail(user.email)}
      />
      {user.username ? (
        children
      ) : (
        <NicknameGate suggested={suggestUsername(name)} />
      )}
    </div>
  );
}
