import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "@/db/store-types";
import { DEFAULT_SETTINGS, loadSettings, saveSetting, type Settings } from "@/db/settings";

type Ctx = {
  settings: Settings;
  /** False until the stored settings are read, so screens do not flash defaults. */
  loaded: boolean;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
};

const SettingsContext = createContext<Ctx>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  update: async () => {},
});

/** Settings stored on the phone, shared by all screens. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const db = useStore();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadSettings(db).then((s) => {
      if (!alive) return;
      setSettings(s);
      setLoaded(true);
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

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  return useContext(SettingsContext);
}
