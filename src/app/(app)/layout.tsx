import { AppHeader } from "@/components/AppHeader";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NicknameGate } from "@/components/NicknameGate";
import { suggestUsername } from "@/lib/username";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, username: true },
  });
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <AppHeader name={user.name} username={user.username} />
      {user.username ? (
        children
      ) : (
        <NicknameGate suggested={suggestUsername(user.name)} />
      )}
    </div>
  );
}
