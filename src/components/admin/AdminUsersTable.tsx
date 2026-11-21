"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUserAsAdmin } from "@/lib/actions/admin";
import styles from "./Admin.module.css";

export type AdminUserView = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  createdAt: string;
  createdKey: string;
  lastSeenKey: string | null;
  lastSeenText: string | null;
  usage: string;
  activeMinutes: number;
  activeDays: number;
  method: string;
  emailVerified: boolean;
  tasks: number;
  goals: number;
  friends: number;
  companies: number;
};

type Sort = "new" | "idle" | "active";

const DAY = 86_400_000;

/** "5 мин назад", "вчера", "12 дн. назад" and how stale that is. */
function lastSeen(key: string | null, now: number): { text: string; tone: string } {
  if (!key) return { text: "ещё нет данных", tone: styles.seenNone };
  const ms = now - new Date(key).getTime();
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(ms / DAY);
  if (minutes < 3) return { text: "сейчас в приложении", tone: styles.seenNow };
  if (minutes < 60) return { text: `${minutes} мин назад`, tone: styles.seenFresh };
  if (ms < DAY) return { text: `${Math.floor(minutes / 60)} ч назад`, tone: styles.seenFresh };
  if (days < 7) return { text: `${days} дн. назад`, tone: styles.seenOk };
  if (days < 30) return { text: `не заходит ${days} дн.`, tone: styles.seenIdle };
  return { text: `не заходит ${days} дн.`, tone: styles.seenGone };
}

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

export function AdminUsersTable({ users, meId }: { users: AdminUserView[]; meId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Captured once per render pass of the list, not on every row.
  const [now] = useState(() => Date.now());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    const list = q
      ? users.filter((u) =>
          [u.name, u.username ?? "", u.email].some((v) => v.toLowerCase().includes(q)),
        )
      : [...users];
    if (sort === "idle") {
      list.sort((a, b) => (a.lastSeenKey ?? "").localeCompare(b.lastSeenKey ?? ""));
    } else if (sort === "active") {
      list.sort((a, b) => b.activeMinutes - a.activeMinutes);
    }
    return list;
  }, [users, query, sort]);

  async function remove(u: AdminUserView) {
    const ok = window.confirm(
      `Удалить ${u.name} (${u.email})?\n\nУдалятся все дела, цели, друзья и достижения. ` +
        "Компании этого человека перейдут другим участникам. Отменить нельзя.\n\n" +
        "На эту почту потом можно будет зарегистрироваться заново.",
    );
    if (!ok) return;
    setBusy(u.id);
    setError(null);
    const result = await deleteUserAsAdmin(u.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.tableBox}>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени, нику или почте"
          aria-label="Поиск"
        />
        <select
          className={styles.sort}
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Сортировка"
        >
          <option value="new">Сначала новые</option>
          <option value="idle">Давно не заходили</option>
          <option value="active">Больше всего времени</option>
        </select>
        <span className={styles.count}>
          {shown.length} из {users.length}
        </span>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Email</th>
              <th>Регистрация</th>
              <th>Последний визит</th>
              <th className={styles.num}>В приложении</th>
              <th className={styles.num}>Дел</th>
              <th className={styles.num}>Целей</th>
              <th className={styles.num}>Друзей</th>
              <th className={styles.num}>Компаний</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const seen = lastSeen(u.lastSeenKey, now);
              return (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    <span className={styles.nick}>
                      {u.username ? `@${u.username}` : "без ника"}
                    </span>
                    <span className={u.method === "Google" ? styles.tagGoogle : styles.tag}>
                      {u.method}
                    </span>
                  </td>
                  <td>
                    {u.email}
                    {u.emailVerified ? (
                      <span className={styles.ok} title="Почта подтверждена">
                        ✓
                      </span>
                    ) : null}
                  </td>
                  <td className={styles.date}>{u.createdAt}</td>
                  <td>
                    <span className={`${styles.seen} ${seen.tone}`}>{seen.text}</span>
                    {u.lastSeenText ? <span className={styles.sub}>{u.lastSeenText}</span> : null}
                  </td>
                  <td className={styles.num}>
                    {u.usage}
                    {u.activeDays > 0 ? (
                      <span className={styles.sub}>
                        за {u.activeDays} {daysWord(u.activeDays)}
                      </span>
                    ) : null}
                  </td>
                  <td className={styles.num}>{u.tasks}</td>
                  <td className={styles.num}>{u.goals}</td>
                  <td className={styles.num}>{u.friends}</td>
                  <td className={styles.num}>{u.companies}</td>
                  <td>
                    {u.id === meId ? (
                      <span className={styles.sub}>это вы</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.delete}
                        disabled={busy === u.id}
                        onClick={() => void remove(u)}
                      >
                        {busy === u.id ? "Удаляю…" : "Удалить"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 ? <p className={styles.empty}>Никого не нашлось</p> : null}
      </div>
      <p className={styles.footnote}>
        Время считается, пока приложение открыто на экране: примерно по минуте за каждую минуту
        использования. Если человек ещё не открывал приложение после этого обновления, данных пока
        нет.
      </p>
    </div>
  );
}
