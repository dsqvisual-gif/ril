"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAwards } from "./useAwards";
import { useRouter } from "next/navigation";
import {
  acceptFriend,
  removeFriendship,
  renameFriend,
  requestFriend,
  searchAccounts,
  type AccountRow,
  type FriendsBoard,
} from "@/lib/actions/friends";
import { Avatar } from "./Avatar";
import styles from "./FriendsPanel.module.css";

type Props = {
  initial: FriendsBoard;
};

export function FriendsPanel({ initial }: Props) {
  const router = useRouter();
  const awards = useAwards();
  const [board, setBoard] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [syncedInitial, setSyncedInitial] = useState(initial);

  if (syncedInitial !== initial) {
    setSyncedInitial(initial);
    setBoard(initial);
  }

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchAccounts(q)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setError("Не удалось выполнить поиск");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const incoming = board.accounts.filter((account) => account.relation === "incoming");
  const friends = board.accounts.filter((account) => account.relation === "friend");
  const outgoing = board.accounts.filter((account) => account.relation === "outgoing");

  function applyAlias(accountId: string, alias: string | null) {
    setBoard((prev) => ({
      ...prev,
      accounts: prev.accounts.map((item) =>
        item.id === accountId ? { ...item, alias } : item,
      ),
    }));
    setResults((prev) =>
      prev?.map((item) => (item.id === accountId ? { ...item, alias } : item)) ?? prev,
    );
  }

  async function rename(account: AccountRow, value: string) {
    if (!account.friendshipId) return;
    setBusyId(account.id);
    setError(null);
    try {
      const result = await renameFriend(account.friendshipId, value);
      if (result.error) {
        setError(result.error);
        return;
      }
      applyAlias(account.id, result.alias ?? null);
    } finally {
      setBusyId(null);
    }
  }

  async function run(id: string, action: () => Promise<{ error?: string }>) {
    setBusyId(id);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      awards.claim();
      const q = query.trim().replace(/^@/, "");
      if (q.length >= 2) {
        setResults(await searchAccounts(q));
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Друзья</h1>
          <p className={styles.sub}>
            Ваш ник <strong>@{board.me.username}</strong>. Человека можно найти только по нику — или
            покажите ему <Link href="/app/settings#qr">свой QR-код</Link>.
          </p>
        </div>
      </header>

      <div className="field">
        <label htmlFor="people-search">Найти аккаунт</label>
        <input
          id="people-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ник, например danil"
        />
      </div>

      {query.trim().replace(/^@/, "").length >= 2 ? (
        <div className={styles.block}>
          <h2>Поиск</h2>
          {searching && !results ? (
            <p className={styles.empty}>Ищем…</p>
          ) : results && results.length > 0 ? (
            <ul className={styles.list}>
              {results.map((account) => (
                <AccountRowView
                  key={account.id}
                  account={account}
                  busy={busyId === account.id}
                  onRun={run}
                  onRename={rename}
                />
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>Никого с таким ником нет.</p>
          )}
        </div>
      ) : (
        <p className={styles.empty}>Введите ник, чтобы найти человека.</p>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      {incoming.length > 0 ? (
        <div className={styles.block}>
          <h2>Заявки</h2>
          <ul className={styles.list}>
            {incoming.map((account) => (
              <li key={account.id} className={styles.row}>
                <Person account={account} />
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === account.id}
                    onClick={() =>
                      account.friendshipId &&
                      run(account.id, () => acceptFriend(account.friendshipId!))
                    }
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === account.id}
                    onClick={() =>
                      account.friendshipId &&
                      run(account.id, () => removeFriendship(account.friendshipId!))
                    }
                  >
                    Отклонить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.block}>
        <h2>Друзья</h2>
        {friends.length === 0 && outgoing.length === 0 ? (
          <p className={styles.empty}>Друзей пока нет. Найдите человека по нику и отправьте заявку.</p>
        ) : (
          <ul className={styles.list}>
            {[...friends, ...outgoing].map((account) => (
              <AccountRowView
                key={account.id}
                account={account}
                busy={busyId === account.id}
                onRun={run}
                onRename={rename}
              />
            ))}
          </ul>
        )}
      </div>
      {awards.toast}
    </section>
  );
}

function AccountRowView({
  account,
  busy,
  onRun,
  onRename,
}: {
  account: AccountRow;
  busy: boolean;
  onRun: (id: string, action: () => Promise<{ error?: string }>) => Promise<void>;
  onRename?: (account: AccountRow, value: string) => Promise<void>;
}) {
  return (
    <li className={styles.row}>
      <Person
        account={account}
        busy={busy}
        onRename={account.relation === "friend" ? onRename : undefined}
      />
      <div className={styles.actions}>
        {account.relation === "none" ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => onRun(account.id, () => requestFriend(account.id))}
          >
            В друзья
          </button>
        ) : null}
        {account.relation === "outgoing" ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() =>
              account.friendshipId &&
              onRun(account.id, () => removeFriendship(account.friendshipId!))
            }
          >
            Отменить заявку
          </button>
        ) : null}
        {account.relation === "friend" ? (
          <>
            <span className={styles.badge}>в друзьях</span>
            <button
              type="button"
              className={styles.textBtn}
              disabled={busy}
              onClick={() =>
                account.friendshipId &&
                onRun(account.id, () => removeFriendship(account.friendshipId!))
              }
            >
              Убрать
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function Person({
  account,
  busy = false,
  onRename,
}: {
  account: AccountRow;
  busy?: boolean;
  onRename?: (account: AccountRow, value: string) => Promise<void>;
}) {
  const shown = account.alias || account.name;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shown);
  const skipBlur = useRef(false);

  async function save() {
    const next = draft.trim();
    setEditing(false);
    if (next === (account.alias || account.name)) return;
    await onRename?.(account, next);
  }

  return (
    <div className={styles.person}>
      <Avatar src={account.avatar} name={shown} size={40} />
      <div className={styles.identity}>
        {editing ? (
          <input
            className={styles.rename}
            value={draft}
            autoFocus
            maxLength={40}
            aria-label="Своё имя для друга"
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (skipBlur.current) {
                skipBlur.current = false;
                return;
              }
              void save();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                skipBlur.current = true;
                void save();
              }
              if (event.key === "Escape") {
                skipBlur.current = true;
                setDraft(account.alias || account.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <div className={styles.nameLine}>
            <p className={styles.name}>{shown}</p>
            {onRename ? (
              <button
                type="button"
                className={styles.pencil}
                aria-label="Переименовать"
                disabled={busy}
                onClick={() => {
                  setDraft(account.alias || account.name);
                  setEditing(true);
                }}
              >
                <PencilIcon />
              </button>
            ) : null}
          </div>
        )}
        <p className={styles.nick}>
          {account.alias ? <span>{account.name} · </span> : null}@{account.username}
        </p>
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.2 6.8l3 3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
