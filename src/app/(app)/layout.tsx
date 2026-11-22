import { AppHeader } from "@/components/AppHeader";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NicknameGate } from "@/components/NicknameGate";
import { suggestUsername } from "@/lib/username";
import { isAdminEmail } from "@/lib/admin";
import { ActivityPing } from "@/components/ActivityPing";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ThemeSync } from "@/components/theme/ThemeSync";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { ChildInvites } from "@/components/baby/ChildInvites";
import { listChildInvites } from "@/lib/actions/baby-care";
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
  const exists = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, theme: true, onboardedAt: true, momMode: true },
  });
  if (!exists) redirect("/goodbye");
  const name = user.name ?? "";
  const childInvites = await listChildInvites();

  return (
    <div className={exists.momMode ? "app-shell mom-mode" : "app-shell"}>
      <ActivityPing />
      <ThemeSync theme={exists.theme} />
      <InstallPrompt />
      <AppHeader
        name={name}
        username={user.username ?? null}
        isAdmin={isAdminEmail(user.email)}
        momMode={exists.momMode}
      />
      {user.username && !exists.onboardedAt ? <Onboarding /> : null}
      {childInvites.length > 0 ? <ChildInvites invites={childInvites} /> : null}
      {user.username ? (
        children
      ) : (
        <NicknameGate suggested={suggestUsername(name)} />
      )}
    </div>
  );
}
