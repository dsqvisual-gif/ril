import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatAdminDate } from "@/lib/admin-users";
import { prisma } from "@/lib/prisma";
import { setErrorStatus } from "@/lib/actions/admin";
import styles from "@/components/admin/Errors.module.css";

export const metadata: Metadata = {
  title: "Ошибки — Uspeyka",
};

export const dynamic = "force-dynamic";

const TABS = [
  { id: "open", label: "Открытые" },
  { id: "fixed", label: "Исправленные" },
  { id: "ignored", label: "Скрытые" },
] as const;

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const status = TABS.some((t) => t.id === raw) ? raw! : "open";
  const [errors, counts] = await Promise.all([
    prisma.errorEvent.findMany({ where: { status }, orderBy: { lastSeen: "desc" }, take: 100 }),
    prisma.errorEvent.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (id: string) => counts.find((c) => c.status === id)?._count ?? 0;

  return (
    <section className={styles.root}>
      <header>
        <p className={styles.back}>
          <Link href="/app/admin">← Пользователи</Link>
        </p>
        <h1 className={styles.title}>Ошибки у пользователей</h1>
        <p className={styles.lead}>
          Собираются автоматически — на сервере и в браузерах. Одинаковые ошибки склеиваются в одну
          строку со счётчиком. Каждую ночь задача разбирает открытые, чинит код и отмечает
          исправленные; если ошибка повторится, она снова станет открытой.
        </p>
      </header>

      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/app/admin/errors?status=${t.id}`}
            className={t.id === status ? styles.tabOn : styles.tab}
          >
            {t.label} · {countOf(t.id)}
          </Link>
        ))}
      </nav>

      {errors.length === 0 ? (
        <p className={styles.empty}>{status === "open" ? "Открытых ошибок нет 🎉" : "Здесь пусто"}</p>
      ) : (
        <ul className={styles.list}>
          {errors.map((e) => (
            <li key={e.id} className={styles.item}>
              <div className={styles.head}>
                <span className={e.source === "server" ? styles.server : styles.client}>
                  {e.source === "server" ? "сервер" : "браузер"}
                </span>
                <b className={styles.count}>×{e.count}</b>
                <span className={styles.when}>
                  последний раз {formatAdminDate(e.lastSeen, "table")} · впервые{" "}
                  {formatAdminDate(e.firstSeen, "table")}
                </span>
              </div>
              <p className={styles.message}>{e.message}</p>
              {e.path ? <p className={styles.meta}>Где: {e.path}</p> : null}
              {e.context ? <p className={styles.meta}>{e.context}</p> : null}
              {e.fixNote ? <p className={styles.note}>Что сделано: {e.fixNote}</p> : null}
              {e.stack ? (
                <details className={styles.stack}>
                  <summary>Стек</summary>
                  <pre>{e.stack}</pre>
                </details>
              ) : null}
              <div className={styles.actions}>
                {e.status !== "fixed" ? (
                  <form action={setErrorStatus.bind(null, e.id, "fixed")}>
                    <button type="submit">Исправлено</button>
                  </form>
                ) : null}
                {e.status !== "ignored" ? (
                  <form action={setErrorStatus.bind(null, e.id, "ignored")}>
                    <button type="submit">Скрыть</button>
                  </form>
                ) : null}
                {e.status !== "open" ? (
                  <form action={setErrorStatus.bind(null, e.id, "open")}>
                    <button type="submit">Открыть снова</button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
