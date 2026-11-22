import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Brand } from "@/components/Brand";
import { Avatar } from "@/components/Avatar";
import { RememberFriendLink } from "@/components/friends/RememberFriendLink";
import styles from "./add.module.css";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

async function findPerson(raw: string) {
  const username = decodeURIComponent(raw).toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return null;
  return prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true, image: true, avatarVersion: true },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const person = await findPerson((await params).username);
  return { title: person ? `${person.name} зовёт в Uspeyka` : "Uspeyka" };
}

/** Landing page of a friend QR code or link. */
export default async function AddFriendPage({ params }: Params) {
  const person = await findPerson((await params).username);
  if (!person?.username) notFound();

  const session = await auth();
  if (session?.user?.id === person.id) redirect("/app/settings#qr");
  // Signed in: remember the link and open the app, which asks "add as a friend?".
  if (session?.user?.id) {
    return <RememberFriendLink username={person.username} thenGo="/app/friends" />;
  }

  return (
    <div className={styles.page}>
      <RememberFriendLink username={person.username} />
      <header className={styles.header}>
        <Brand href="/" />
      </header>
      <main className={styles.card}>
        <Avatar src={person.image} name={person.name} size={88} />
        <h1>{person.name}</h1>
        <p className={styles.nick}>@{person.username}</p>
        <p className={styles.lead}>
          зовёт вас в друзья в Uspeyka — планере, где можно вести общие дела вместе.
        </p>
        <div className={styles.actions}>
          <Link href="/register" className="btn btn-primary">
            Зарегистрироваться
          </Link>
          <Link href="/login" className="btn btn-ghost">
            У меня есть аккаунт
          </Link>
        </div>
        <p className={styles.hint}>После входа мы сразу предложим добавить @{person.username} в друзья.</p>
      </main>
    </div>
  );
}
