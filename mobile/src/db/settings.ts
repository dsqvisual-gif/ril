import type { Store } from "./store-types";
import { isThemeId, type ThemeId } from "@/theme/themes";

export type ThemePref = "system" | ThemeId;

export type Settings = {
  name: string;
  theme: ThemePref;
  /** The welcome screens were shown. */
  onboarded: boolean;
  /** Mom mode of the account: the baby tracker and warmer colours. */
  mom: boolean;
};

export const DEFAULT_SETTINGS: Settings = { name: "", theme: "system", onboarded: false, mom: false };

export async function loadSettings(store: Store): Promise<Settings> {
  const map = new Map(Object.entries(await store.allSettings()));
  const theme = map.get("theme");
  return {
    name: map.get("name") ?? DEFAULT_SETTINGS.name,
    theme: isThemeId(theme) ? theme : "system",
    onboarded: map.get("onboarded") === "true",
    mom: map.get("mom") === "true",
  };
}

export async function saveSetting(store: Store, key: keyof Settings | "account_user", value: string): Promise<void> {
  await store.setSetting(key, value);
}
