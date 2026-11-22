import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { DEFAULT_SETTINGS, loadSettings, saveSetting, type Settings } from "@/db/settings";

type Ctx = {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
};

const SettingsContext = createContext<Ctx>({
  settings: DEFAULT_SETTINGS,
  update: async () => {},
});

/** Settings stored on the phone, shared by all screens. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let alive = true;
    void loadSettings(db).then((s) => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
    };
  }, [db]);

  const update = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      await saveSetting(db, key, String(value));
    },
    [db],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  return useContext(SettingsContext);
}
