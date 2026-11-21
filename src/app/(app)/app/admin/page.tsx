import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { adminStats, formatAdminDate, listAdminUsers } from "@/lib/admin-users";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import styles from "@/components/admin/Admin.module.css";

export const metadata: Metadata = {
  title: "Пользователи — Uspeyka",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const users = await listAdminUsers();
  const stats = adminStats(users);

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Пользователи</h1>
          <p className={styles.lead}>
            Все, кто зарегистрировался, по времени Казахстана. Список обновляется сам — просто
            обновите страницу.
          </p>
        </div>
        <a className="btn btn-primary" href="/app/admin/users.csv">
          Скачать таблицу (CSV)
        </a>
      </header>

      <div className={styles.stats}>
        {stats.map((s) => (
          <div key={s.label} className={styles.stat}>
            <b>{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <AdminUsersTable
        users={users.map((u) => ({
          ...u,
          createdAt: formatAdminDate(u.createdAt, "table"),
          createdKey: u.createdAt.toISOString(),
        }))}
      />
    </section>
  );
}
