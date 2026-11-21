import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import styles from "@/components/settings/Settings.module.css";

export const metadata: Metadata = {
  title: "Профиль — Uspeyka",
};

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      username: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      createdAt: true,
    },
  });
  if (!user) notFound();

  return (
    <section className={styles.root}>
      <h1 className={styles.title}>Профиль</h1>

      <div className={styles.card}>
        <dl className={styles.list}>
          <div>
            <dt>Имя</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Ник</dt>
            <dd>{user.username ? `@${user.username}` : "—"}</dd>
          </div>
          <div>
            <dt>Почта</dt>
            <dd>
              {user.email}
              {user.emailVerified ? <span className={styles.ok}> ✓ подтверждена</span> : null}
            </dd>
          </div>
          <div>
            <dt>Вход</dt>
            <dd>{user.passwordHash ? "Пароль, код из письма или Google" : "Google или код из письма"}</dd>
          </div>
          <div>
            <dt>С нами с</dt>
            <dd>{format(user.createdAt, "d MMMM yyyy", { locale: ru })}</dd>
          </div>
        </dl>
        <p className={styles.hint}>
          Забыли пароль или хотите его сменить — воспользуйтесь{" "}
          <a href="/forgot">восстановлением по коду</a>.
        </p>
      </div>

      <DeleteAccount confirmWord={user.username ? `@${user.username}` : user.email} />
    </section>
  );
}
