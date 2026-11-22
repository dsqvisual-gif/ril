import { useMemo } from "react";
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { migrate } from "./migrations";
import { StoreContext, type Store } from "./store-types";

function sqliteStore(db: SQLiteDatabase): Store {
  return {
    async getSetting(key) {
      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
      return row?.value ?? null;
    },
    async setSetting(key, value) {
      await db.runAsync(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        key,
        value,
      );
    },
    async deleteSetting(key) {
      await db.runAsync("DELETE FROM settings WHERE key = ?", key);
    },
    async allSettings() {
      const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
    async getCache(key) {
      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM cache WHERE key = ?", key);
      return row?.value ?? null;
    },
    async setCache(key, value) {
      await db.runAsync(
        "INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        key,
        value,
        new Date().toISOString(),
      );
    },
    async outboxAdd(kind, payload) {
      await db.runAsync("INSERT INTO outbox (kind, payload, created_at) VALUES (?, ?, ?)", kind, payload, new Date().toISOString());
    },
    async outboxFirst() {
      return (await db.getFirstAsync<{ id: number; payload: string }>("SELECT id, payload FROM outbox ORDER BY id LIMIT 1")) ?? null;
    },
    async outboxDelete(id) {
      await db.runAsync("DELETE FROM outbox WHERE id = ?", id);
    },
    async outboxDeleteContaining(text) {
      await db.runAsync("DELETE FROM outbox WHERE instr(payload, ?) > 0", text);
    },
    async outboxReplace(from, to, exceptId) {
      await db.runAsync("UPDATE outbox SET payload = REPLACE(payload, ?, ?) WHERE id != ?", from, to, exceptId);
    },
    async outboxCount() {
      const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
      return row?.n ?? 0;
    },
    async clearAccount() {
      await db.execAsync("DELETE FROM cache; DELETE FROM outbox;");
    },
  };
}

function Bridge({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const store = useMemo(() => sqliteStore(db), [db]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** On phones the data lives in SQLite, so the planner works without internet. */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <SQLiteProvider databaseName="uspeyka.db" onInit={migrate} useSuspense>
      <Bridge>{children}</Bridge>
    </SQLiteProvider>
  );
}
