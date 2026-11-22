import type { SQLiteDatabase } from "expo-sqlite";

export type ThemePref = "system" | "light" | "dark";

export type Settings = {
  name: string;
  theme: ThemePref;
};

export const DEFAULT_SETTINGS: Settings = { name: "", theme: "system" };

export async function loadSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const theme = map.get("theme");
  return {
    name: map.get("name") ?? DEFAULT_SETTINGS.name,
    theme: theme === "light" || theme === "dark" ? theme : "system",
  };
}

export async function saveSetting(db: SQLiteDatabase, key: keyof Settings, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}
