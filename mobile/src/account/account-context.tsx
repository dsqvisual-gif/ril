import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "@/db/store-types";
import { saveSetting } from "@/db/settings";
import { fetchMe, type AccountUser, type Session } from "./api";
import { readToken, writeToken } from "./storage";

type Ctx = {
  user: AccountUser | null;
  token: string | null;
  ready: boolean;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<Ctx>({
  user: null,
  token: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
});

const USER_CACHE = "account_user";

/**
 * The Uspeyka account the app is signed in to, if any. The profile is cached
 * on the phone, so it shows offline too; it is refreshed when there is a connection.
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const db = useStore();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const remember = useCallback(
    async (next: AccountUser | null) => {
      setUser(next);
      if (next) await saveSetting(db, USER_CACHE, JSON.stringify(next));
      else await db.deleteSetting(USER_CACHE);
    },
    [db],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const saved = await readToken();
      const cached = await db.getSetting(USER_CACHE);
      if (!alive) return;
      if (saved) {
        setToken(saved);
        if (cached) setUser(JSON.parse(cached) as AccountUser);
      }
      setReady(true);
      if (!saved) return;
      try {
        const fresh = await fetchMe(saved);
        if (!alive) return;
        if (fresh) await remember(fresh);
        else {
          // The account was signed out elsewhere or deleted.
          await writeToken(null);
          setToken(null);
          await remember(null);
        }
      } catch {
        // Offline: keep the cached profile; the planner works from its copy.
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, remember]);

  const signIn = useCallback(
    async (session: Session) => {
      await writeToken(session.token);
      setToken(session.token);
      await remember(session.user);
    },
    [remember],
  );

  const signOut = useCallback(async () => {
    await writeToken(null);
    setToken(null);
    await remember(null);
    // The account's tasks stay with the account, not on the phone.
    await db.clearAccount();
  }, [remember, db]);

  const value = useMemo(() => ({ user, token, ready, signIn, signOut }), [user, token, ready, signIn, signOut]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): Ctx {
  return useContext(AccountContext);
}
