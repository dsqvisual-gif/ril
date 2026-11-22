import type { Store } from "./store-types";

export type ThemePref = "system" | "light" | "dark";

export type Settings = {
  name: string;
  theme: ThemePref;
  /** The welcome screens were shown. */
  onboarded: boolean;
};

export const DEFAULT_SETTINGS: Settings = { name: "", theme: "system", onboarded: false };

export async function loadSettings(store: Store): Promise<Settings> {
  const map = new Map(Object.entries(await store.allSettings()));
  const theme = map.get("theme");
  return {
    name: map.get("name") ?? DEFAULT_SETTINGS.name,
    theme: theme === "light" || theme === "dark" ? theme : "system",
    onboarded: map.get("onboarded") === "true",
  };
}

export async function saveSetting(store: Store, key: keyof Settings | "account_user", value: string): Promise<void> {
  await store.setSetting(key, value);
}
