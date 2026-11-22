import { useMemo } from "react";
import { StoreContext, type OutboxRow, type Store } from "./store-types";

/**
 * The browser version keeps its data in localStorage. SQLite in the browser needs
 * OPFS file handles, which Safari refuses in home-screen apps ("The object is in
 * an invalid state"), so it is not used on the web at all.
 */

const PREFIX = "uspeyka:";
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, value);
  } catch {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
  }
}

function json<T>(key: string, fallback: T): T {
  const raw = read(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type Outbox = { next: number; rows: OutboxRow[] };

const settings = () => json<Record<string, string>>("settings", {});
const outbox = () => json<Outbox>("outbox", { next: 1, rows: [] });
const saveOutbox = (o: Outbox) => write("outbox", JSON.stringify(o));
const cacheKeys = () => json<string[]>("cache-keys", []);

const webStore: Store = {
  async getSetting(key) {
    return settings()[key] ?? null;
  },
  async setSetting(key, value) {
    write("settings", JSON.stringify({ ...settings(), [key]: value }));
  },
  async deleteSetting(key) {
    const s = settings();
    delete s[key];
    write("settings", JSON.stringify(s));
  },
  async allSettings() {
    return settings();
  },
  async getCache(key) {
    return read(`cache:${key}`);
  },
  async setCache(key, value) {
    const keys = cacheKeys();
    if (!keys.includes(key)) write("cache-keys", JSON.stringify([...keys, key]));
    write(`cache:${key}`, value);
  },
  async outboxAdd(_kind, payload) {
    const o = outbox();
    o.rows.push({ id: o.next, payload });
    o.next += 1;
    saveOutbox(o);
  },
  async outboxFirst() {
    return outbox().rows[0] ?? null;
  },
  async outboxDelete(id) {
    const o = outbox();
    o.rows = o.rows.filter((r) => r.id !== id);
    saveOutbox(o);
  },
  async outboxDeleteContaining(text) {
    const o = outbox();
    o.rows = o.rows.filter((r) => !r.payload.includes(text));
    saveOutbox(o);
  },
  async outboxReplace(from, to, exceptId) {
    const o = outbox();
    o.rows = o.rows.map((r) => (r.id === exceptId ? r : { ...r, payload: r.payload.split(from).join(to) }));
    saveOutbox(o);
  },
  async outboxCount() {
    return outbox().rows.length;
  },
  async clearAccount() {
    for (const key of cacheKeys()) write(`cache:${key}`, null);
    write("cache-keys", null);
    write("outbox", null);
  },
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo(() => webStore, []);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
