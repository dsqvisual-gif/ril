import type { SQLiteDatabase } from "expo-sqlite";
import { ApiError, NetworkError, SignedOutError, type Task, type TaskInput, type ToggleResult } from "./api";

/**
 * The planner keeps working without internet: each day's tasks are copied to the
 * phone, and changes made offline wait in an outbox until the website can be reached.
 */

export type Op =
  | { kind: "create"; tempId: string; input: TaskInput }
  | { kind: "toggle"; id: string; done: boolean }
  | { kind: "delete"; id: string };

type Call = <T>(fn: string, ...args: unknown[]) => Promise<T>;

const dayKey = (date: string) => `tasks:${date}`;

export function isOffline(error: unknown): boolean {
  return error instanceof NetworkError;
}

export async function readDay(db: SQLiteDatabase, date: string): Promise<Task[] | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM cache WHERE key = ?", dayKey(date));
  return row ? (JSON.parse(row.value) as Task[]) : null;
}

export async function writeDay(db: SQLiteDatabase, date: string, tasks: Task[]): Promise<void> {
  await db.runAsync(
    "INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    dayKey(date),
    JSON.stringify(tasks),
    new Date().toISOString(),
  );
}

export async function enqueue(db: SQLiteDatabase, op: Op): Promise<void> {
  // A task made offline and deleted before it was ever sent simply disappears.
  if (op.kind === "delete" && op.id.startsWith("local-")) {
    await db.runAsync("DELETE FROM outbox WHERE payload LIKE ?", `%${op.id}%`);
    return;
  }
  await db.runAsync(
    "INSERT INTO outbox (kind, payload, created_at) VALUES (?, ?, ?)",
    op.kind,
    JSON.stringify(op),
    new Date().toISOString(),
  );
}

export async function pendingCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
  return row?.n ?? 0;
}

/** Forget everything of the account on this phone (signing out). */
export async function clearOffline(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("DELETE FROM cache; DELETE FROM outbox;");
}

/** A task created offline, shown until the website gives it a real id. */
export function localTask(input: TaskInput): Task {
  return {
    id: `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim(),
    date: input.date,
    originDate: input.date,
    keptOn: null,
    time: input.time ?? null,
    important: Boolean(input.important),
    urgent: Boolean(input.urgent),
    done: false,
    shared: false,
    viewerIsOwner: true,
    ownerName: null,
    partners: [],
    note: input.note ?? null,
    items: [],
  };
}

/**
 * Sends waiting changes in order. Stops at the first connection problem and keeps
 * the rest for later; a change the website refuses (e.g. the task was deleted on
 * the site) is dropped. Returns how many changes were sent.
 */
export async function flush(db: SQLiteDatabase, call: Call): Promise<number> {
  let sent = 0;
  for (;;) {
    const row = await db.getFirstAsync<{ id: number; payload: string }>("SELECT id, payload FROM outbox ORDER BY id LIMIT 1");
    if (!row) return sent;
    const op = JSON.parse(row.payload) as Op;
    try {
      if (op.kind === "create") {
        const task = await call<Task>("tasks.create", op.input);
        // Later changes to this task now point at its real id.
        await db.runAsync("UPDATE outbox SET payload = REPLACE(payload, ?, ?) WHERE id != ?", op.tempId, task.id, row.id);
      } else if (op.kind === "toggle") {
        const r = await call<ToggleResult>("tasks.toggle", op.id);
        if (r.task.done !== op.done) await call<ToggleResult>("tasks.toggle", op.id);
      } else {
        await call("tasks.delete", op.id);
      }
    } catch (error) {
      if (error instanceof NetworkError || error instanceof SignedOutError) return sent;
      if (!(error instanceof ApiError)) return sent;
      // Refused by the website: nothing more to do with this change.
    }
    await db.runAsync("DELETE FROM outbox WHERE id = ?", row.id);
    sent += 1;
  }
}
