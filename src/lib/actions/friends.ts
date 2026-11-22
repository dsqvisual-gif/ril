"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { avatarSrc } from "@/lib/avatar";

export type AccountRow = {
  id: string;
  name: string;
  username: string;
  alias: string | null;
  avatar: string | null;
  relation: "none" | "friend" | "incoming" | "outgoing";
  friendshipId: string | null;
};

export type FriendsBoard = {
  me: { id: string; name: string; username: string };
  accounts: AccountRow[];
};

export type FriendOption = {
  id: string;
  name: string;
  username: string;
  alias: string | null;
  avatar: string | null;
};

export type FriendActionState = {
  error?: string;
  alias?: string | null;
};

function otherId(
  row: { requesterId: string; addresseeId: string },
  me: string,
): string {
  return row.requesterId === me ? row.addresseeId : row.requesterId;
}

function viewerAlias(
  row: { requesterId: string; requesterAlias: string | null; addresseeAlias: string | null },
  userId: string,
): string | null {
  const raw = row.requesterId === userId ? row.requesterAlias : row.addresseeAlias;
  const alias = raw?.trim();
  return alias || null;
}

function relationFor(
  row: { id: string; status: string; requesterId: string; addresseeId: string } | undefined,
  userId: string,
): Pick<AccountRow, "relation" | "friendshipId"> {
  if (!row) return { relation: "none", friendshipId: null };
  if (row.status === "accepted") return { relation: "friend", friendshipId: row.id };
  if (row.status === "pending" && row.addresseeId === userId) {
    return { relation: "incoming", friendshipId: row.id };
  }
  if (row.status === "pending") return { relation: "outgoing", friendshipId: row.id };
  return { relation: "none", friendshipId: row.id };
}

export async function getFriendsBoard(): Promise<FriendsBoard> {
  const userId = await requireUserId();
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true },
  });
  if (!me?.username) {
    return { me: { id: userId, name: me?.name ?? "", username: "" }, accounts: [] };
  }

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, name: true, username: true, image: true, avatarVersion: true } },
      addressee: { select: { id: true, name: true, username: true, image: true, avatarVersion: true } },
    },
  });

  const accounts: AccountRow[] = friendships.flatMap((row) => {
    const person = row.requesterId === userId ? row.addressee : row.requester;
    if (!person.username) return [];
    const relation = relationFor(row, userId);
    const alias = relation.relation === "friend" ? viewerAlias(row, userId) : null;
    return [
      {
        id: person.id,
        name: person.name,
        username: person.username,
        alias,
        avatar: avatarSrc(person),
        relation: relation.relation,
        friendshipId: relation.friendshipId,
      },
    ];
  });

  accounts.sort((a, b) =>
    (a.alias || a.name).localeCompare(b.alias || b.name, "ru"),
  );

  return {
    me: { id: me.id, name: me.name, username: me.username },
    accounts,
  };
}

export async function searchAccounts(raw: string): Promise<AccountRow[]> {
  const userId = await requireUserId();
  const query = raw.trim().toLowerCase().replace(/^@/, "");
  if (query.length < 2) return [];

  const people = await prisma.user.findMany({
    where: {
      id: { not: userId },
      username: { contains: query, mode: "insensitive" },
    },
    select: { id: true, name: true, username: true, image: true, avatarVersion: true },
    orderBy: { username: "asc" },
    take: 8,
  });

  const ids = people.map((person) => person.id);
  const friendships = ids.length
    ? await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: userId, addresseeId: { in: ids } },
            { addresseeId: userId, requesterId: { in: ids } },
          ],
        },
      })
    : [];

  const byUser = new Map(friendships.map((row) => [otherId(row, userId), row]));

  return people.flatMap((person) => {
    if (!person.username) return [];
    const row = byUser.get(person.id);
    const relation = relationFor(row, userId);
    return [
      {
        id: person.id,
        name: person.name,
        username: person.username,
        alias: relation.relation === "friend" && row ? viewerAlias(row, userId) : null,
        avatar: avatarSrc(person),
        relation: relation.relation,
        friendshipId: relation.friendshipId,
      },
    ];
  });
}

export async function listAcceptedFriends(): Promise<FriendOption[]> {
  const userId = await requireUserId();
  const rows = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, name: true, username: true, image: true, avatarVersion: true } },
      addressee: { select: { id: true, name: true, username: true, image: true, avatarVersion: true } },
    },
  });

  return rows.flatMap((row) => {
    const person = row.requesterId === userId ? row.addressee : row.requester;
    if (!person.username) return [];
    const alias = viewerAlias(row, userId);
    return [
      {
        id: person.id,
        name: alias || person.name,
        username: person.username,
        alias,
        avatar: avatarSrc(person),
      },
    ];
  });
}

function refreshFriends() {
  revalidatePath("/app/friends");
  revalidatePath("/app");
}

export async function requestFriend(targetId: string): Promise<FriendActionState> {
  const userId = await requireUserId();
  if (!targetId || targetId === userId) {
    return { error: "Нельзя добавить себя" };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, username: true },
  });
  if (!target?.username) return { error: "Аккаунт не найден" };

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: targetId },
        { requesterId: targetId, addresseeId: userId },
      ],
    },
  });

  if (existing?.status === "accepted") return { error: "Вы уже друзья" };
  if (existing && existing.requesterId === targetId && existing.addresseeId === userId) {
    await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: "accepted" },
    });
    refreshFriends();
    return {};
  }
  if (existing) return { error: "Заявка уже отправлена" };

  await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: targetId, status: "pending" },
  });
  refreshFriends();
  return {};
}

export async function acceptFriend(friendshipId: string): Promise<FriendActionState> {
  const userId = await requireUserId();
  const row = await prisma.friendship.findFirst({
    where: { id: friendshipId, addresseeId: userId, status: "pending" },
  });
  if (!row) return { error: "Заявка не найдена" };

  await prisma.friendship.update({
    where: { id: row.id },
    data: { status: "accepted" },
  });
  refreshFriends();
  return {};
}

export async function removeFriendship(friendshipId: string): Promise<FriendActionState> {
  const userId = await requireUserId();
  const row = await prisma.friendship.findFirst({
    where: {
      id: friendshipId,
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
  if (!row) return { error: "Запись не найдена" };

  await prisma.friendship.delete({ where: { id: row.id } });
  refreshFriends();
  return {};
}

export async function renameFriend(
  friendshipId: string,
  raw: string,
): Promise<FriendActionState> {
  const userId = await requireUserId();
  const row = await prisma.friendship.findFirst({
    where: {
      id: friendshipId,
      status: "accepted",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { name: true } },
      addressee: { select: { name: true } },
    },
  });
  if (!row) return { error: "Друг не найден" };

  const person = row.requesterId === userId ? row.addressee : row.requester;
  const alias = raw.trim().replace(/\s+/g, " ").slice(0, 40);
  const stored =
    !alias || alias.toLocaleLowerCase("ru") === person.name.trim().toLocaleLowerCase("ru")
      ? null
      : alias;

  await prisma.friendship.update({
    where: { id: row.id },
    data: row.requesterId === userId ? { requesterAlias: stored } : { addresseeAlias: stored },
  });
  refreshFriends();
  return { alias: stored };
}

/** Forgets a friend link opened before signing in, whether it was used or dismissed. */
export async function clearPendingFriend(): Promise<void> {
  const { cookies } = await import("next/headers");
  const { PENDING_FRIEND_COOKIE } = await import("@/lib/friend-link");
  (await cookies()).delete(PENDING_FRIEND_COOKIE);
}

/** Sends a friend request from a QR link and forgets the link. */
export async function addFriendFromLink(targetId: string): Promise<FriendActionState> {
  const result = await requestFriend(targetId);
  await clearPendingFriend();
  return result;
}
