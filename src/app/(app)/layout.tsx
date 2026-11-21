import { AppHeader } from "@/components/AppHeader";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NicknameGate } from "@/components/NicknameGate";
import { suggestUsername } from "@/lib/username";
import { isAdminEmail } from "@/lib/admin";

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
  const name = user.name ?? "";

  return (
    <div className="app-shell">
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
