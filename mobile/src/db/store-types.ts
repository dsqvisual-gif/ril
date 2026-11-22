import { createContext, useContext } from "react";

/** A change made offline, waiting to be sent to the website. */
export type OutboxRow = { id: number; payload: string };

/**
 * What the app keeps on the device: settings, the offline copy of the planner
 * and the outbox. On phones it is SQLite; in the browser version it is
 * localStorage, because Safari's home-screen apps cannot open SQLite files.
 */
export type Store = {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;
  allSettings(): Promise<Record<string, string>>;
  getCache(key: string): Promise<string | null>;
  setCache(key: string, value: string): Promise<void>;
  outboxAdd(kind: string, payload: string): Promise<void>;
  outboxFirst(): Promise<OutboxRow | null>;
  outboxDelete(id: number): Promise<void>;
  /** Drops every waiting change whose payload contains the text. */
  outboxDeleteContaining(text: string): Promise<void>;
  /** Rewrites a temporary id to the real one in every other waiting change. */
  outboxReplace(from: string, to: string, exceptId: number): Promise<void>;
  outboxCount(): Promise<number>;
  /** Forgets the account's planner copy and waiting changes. */
  clearAccount(): Promise<void>;
};

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("StoreProvider is missing");
  return store;
}
