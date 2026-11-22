import { AppHeader } from "@/components/AppHeader";
import { avatarSrc } from "@/lib/avatar";
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
import { cookies } from "next/headers";
import { PENDING_FRIEND_COOKIE } from "@/lib/friend-link";
import { FriendLinkPrompt, type FriendLinkTarget } from "@/components/friends/FriendLinkPrompt";

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
    select: {
      id: true,
      name: true,
      theme: true,
      onboardedAt: true,
      momMode: true,
      image: true,
      avatarVersion: true,
    },
  });
  if (!exists) redirect("/goodbye");
  // From the DB, so a renamed profile shows at once (the session keeps the old name).
  const name = exists.name || user.name || "";
  const childInvites = await listChildInvites();
  const friendLink =
    user.username && exists.onboardedAt ? await pendingFriendLink(user.id) : null;

  return (
    <div className={exists.momMode ? "app-shell mom-mode" : "app-shell"}>
      <ActivityPing />
      <ThemeSync theme={exists.theme} />
      <InstallPrompt />
      <AppHeader
        name={name}
        username={user.username ?? null}
        avatar={avatarSrc(exists)}
        isAdmin={isAdminEmail(user.email)}
        momMode={exists.momMode}
      />
      {user.username && !exists.onboardedAt ? <Onboarding /> : null}
      {childInvites.length > 0 ? <ChildInvites invites={childInvites} /> : null}
      {friendLink ? <FriendLinkPrompt key={friendLink.id} target={friendLink} /> : null}
      {user.username ? (
        children
      ) : (
        <NicknameGate suggested={suggestUsername(name)} />
      )}
    </div>
  );
}

/** Whose friend QR or link was opened before this visit, and how they relate to the viewer. */
async function pendingFriendLink(userId: string): Promise<FriendLinkTarget | null> {
  const raw = (await cookies()).get(PENDING_FRIEND_COOKIE)?.value;
  if (!raw) return null;
  const username = decodeURIComponent(raw).toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return null;
  const person = await prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true, image: true, avatarVersion: true },
  });
  if (!person?.username) return null;
  const base = { id: person.id, name: person.name, username: person.username, avatar: avatarSrc(person) };
  if (person.id === userId) return { ...base, state: "self" };
  const link = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: person.id },
        { requesterId: person.id, addresseeId: userId },
      ],
    },
    select: { status: true, requesterId: true },
  });
  if (!link) return { ...base, state: "new" };
  if (link.status === "accepted") return { ...base, state: "friends" };
  return { ...base, state: link.requesterId === userId ? "sent" : "incoming" };
}
