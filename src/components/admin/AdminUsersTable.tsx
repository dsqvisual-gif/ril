"use client";

import { useMemo, useState } from "react";
import styles from "./Admin.module.css";

export type AdminUserView = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  createdAt: string;
  createdKey: string;
  method: string;
  emailVerified: boolean;
  tasks: number;
  goals: number;
  friends: number;
  companies: number;
};

export function AdminUsersTable({ users }: { users: AdminUserView[] }) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.username ?? "", u.email].some((v) => v.toLowerCase().includes(q)),
    );
  }, [users, query]);

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
        <span className={styles.count}>
          {shown.length} из {users.length}
        </span>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Email</th>
              <th>Регистрация</th>
              <th>Вход</th>
              <th className={styles.num}>Дел</th>
              <th className={styles.num}>Целей</th>
              <th className={styles.num}>Друзей</th>
              <th className={styles.num}>Компаний</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.name}</b>
                  <span className={styles.nick}>{u.username ? `@${u.username}` : "без ника"}</span>
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
                  <span className={u.method === "Google" ? styles.tagGoogle : styles.tag}>
                    {u.method}
                  </span>
                </td>
                <td className={styles.num}>{u.tasks}</td>
                <td className={styles.num}>{u.goals}</td>
                <td className={styles.num}>{u.friends}</td>
                <td className={styles.num}>{u.companies}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 ? <p className={styles.empty}>Никого не нашлось</p> : null}
      </div>
    </div>
  );
}
