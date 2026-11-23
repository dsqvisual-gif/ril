import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "@/db/store-types";
import { useSettings } from "@/theme/settings-context";
import { isThemeId } from "@/theme/themes";
import { clearAll } from "@/notify/notify";
import { saveSetting } from "@/db/settings";
import { fetchMe, type AccountUser, type Session } from "./api";
import { readToken, writeToken } from "./storage";

type Ctx = {
  user: AccountUser | null;
  token: string | null;
  ready: boolean;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  /** Puts a fresh profile in place after a change (name, photo, nickname…). */
  replaceUser: (user: AccountUser) => Promise<void>;
};

const AccountContext = createContext<Ctx>({
  user: null,
  token: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
  replaceUser: async () => {},
});

const THEME_SEEN = "account_theme_seen";

const USER_CACHE = "account_user";

/**
 * The Uspeyka account the app is signed in to, if any. The profile is cached
 * on the phone, so it shows offline too; it is refreshed when there is a connection.
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const db = useStore();
  const { update: updateSetting } = useSettings();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const remember = useCallback(
    async (next: AccountUser | null) => {
      setUser(next);
      if (next) await saveSetting(db, USER_CACHE, JSON.stringify(next));
      else await db.deleteSetting(USER_CACHE);
      // Mom mode follows the account, so the colours and tabs match the website.
      const mom = Boolean(next?.momMode);
      if ((await db.getSetting("mom")) !== String(mom)) await updateSetting("mom", mom);
      // A theme picked on the website (or another phone) comes here too, once.
      const theme = next?.theme;
      if (isThemeId(theme) && (await db.getSetting(THEME_SEEN)) !== theme) {
        await db.setSetting(THEME_SEEN, theme);
        await updateSetting("theme", theme);
      }
    },
    [db, updateSetting],
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
    await clearAll();
  }, [remember, db]);

  const replaceUser = useCallback((next: AccountUser) => remember(next), [remember]);

  const value = useMemo(
    () => ({ user, token, ready, signIn, signOut, replaceUser }),
    [user, token, ready, signIn, signOut, replaceUser],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): Ctx {
  return useContext(AccountContext);
}
