"use client";

import { useState } from "react";
import Link from "next/link";
import type { FriendOption } from "@/lib/actions/friends";
import styles from "./FriendPicker.module.css";

type Props = {
  friends: FriendOption[];
  selected: string[];
  onToggle: (friendId: string) => void;
  onDone: () => void;
};

export function friendLabel(friend: FriendOption): string {
  return friend.alias || friend.name || `@${friend.username}`;
}

/** The whole friends list for "запланировать с другом", with search when it is long. */
export function FriendPicker({ friends, selected, onToggle, onDone }: Props) {
  const [query, setQuery] = useState("");

  if (friends.length === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.empty}>
          Друзей пока нет. <Link href="/app/friends">Добавьте друга по нику</Link> — и планируйте
          дела вместе: оно появится и у него.
        </p>
      </div>
    );
  }

  const q = query.trim().toLowerCase().replace(/^@/, "");
  const shown = q
    ? friends.filter((f) =>
        [f.alias, f.name, f.username].some((v) => v && v.toLowerCase().includes(q)),
      )
    : friends;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>С кем запланировать</span>
        <button type="button" className={styles.done} onClick={onDone}>
          Готово
        </button>
      </div>
      {friends.length > 6 ? (
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти друга"
          aria-label="Найти друга"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      ) : null}
      <ul className={styles.list}>
        {shown.map((friend) => {
          const on = selected.includes(friend.id);
          const label = friendLabel(friend);
          return (
            <li key={friend.id}>
              <button
                type="button"
                className={on ? `${styles.row} ${styles.rowOn}` : styles.row}
                aria-pressed={on}
                onClick={() => onToggle(friend.id)}
              >
                <span className={styles.avatar} aria-hidden>
                  {label.replace(/^@/, "").slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.who}>
                  <span className={styles.name}>{label}</span>
                  <span className={styles.nick}>@{friend.username}</span>
                </span>
                <span className={styles.tick} aria-hidden>
                  {on ? "✓" : ""}
                </span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 ? <li className={styles.empty}>Никого не нашлось</li> : null}
      </ul>
    </div>
  );
}
