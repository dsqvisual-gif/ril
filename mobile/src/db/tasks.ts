import type { SQLiteDatabase } from "expo-sqlite";
import { newId, nowIso } from "./id";

export type TaskItem = { id: string; text: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  date: string;
  originDate: string;
  time: string | null;
  important: boolean;
  urgent: boolean;
  done: boolean;
  note: string | null;
  items: TaskItem[];
};

export type TaskInput = {
  title: string;
  date: string;
  time?: string | null;
  important?: boolean;
  urgent?: boolean;
  note?: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  date: string;
  origin_date: string;
  time: string | null;
  important: number;
  urgent: number;
  done: number;
  note: string | null;
};

type ItemRow = { id: string; task_id: string; text: string; done: number };

export const TITLE_MAX = 140;

function toTask(row: TaskRow, items: TaskItem[]): Task {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    originDate: row.origin_date,
    time: row.time,
    important: row.important === 1,
    urgent: row.urgent === 1,
    done: row.done === 1,
    note: row.note,
    items,
  };
}

/** Tasks between two dates (inclusive), urgent and important first, like on the website. */
export async function listTasks(db: SQLiteDatabase, from: string, to: string): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks
     WHERE deleted_at IS NULL AND date >= ? AND date <= ?
     ORDER BY urgent DESC, important DESC, time IS NULL, time, created_at`,
    from,
    to,
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const items = await db.getAllAsync<ItemRow>(
    `SELECT id, task_id, text, done FROM task_items
     WHERE task_id IN (${ids.map(() => "?").join(",")}) ORDER BY position`,
    ...ids,
  );
  const byTask = new Map<string, TaskItem[]>();
  for (const it of items) {
    const list = byTask.get(it.task_id) ?? [];
    list.push({ id: it.id, text: it.text, done: it.done === 1 });
    byTask.set(it.task_id, list);
  }
  return rows.map((r) => toTask(r, byTask.get(r.id) ?? []));
}

export async function createTask(db: SQLiteDatabase, input: TaskInput): Promise<string> {
  const title = input.title.trim().slice(0, TITLE_MAX);
  if (!title) throw new Error("Название обязательно");
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO tasks (id, title, date, origin_date, time, important, urgent, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    title,
    input.date,
    input.date,
    input.time ?? null,
    input.important ? 1 : 0,
    input.urgent ? 1 : 0,
    input.note?.trim() || null,
    now,
    now,
  );
  return id;
}

export async function setDone(db: SQLiteDatabase, id: string, done: boolean): Promise<void> {
  const now = nowIso();
  await db.runAsync(
    "UPDATE tasks SET done = ?, done_at = ?, updated_at = ? WHERE id = ?",
    done ? 1 : 0,
    done ? now : null,
    now,
    id,
  );
}

/** Soft delete, so "Отменить" can bring it back and a future sync can pass it on. */
export async function deleteTask(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await db.runAsync("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?", now, now, id);
}

export async function restoreTask(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?", nowIso(), id);
}

/** Moves a task to another day; `originDate` lets "Отменить" restore the old one. */
export async function moveTask(
  db: SQLiteDatabase,
  id: string,
  date: string,
  originDate: string = date,
): Promise<void> {
  await db.runAsync(
    "UPDATE tasks SET date = ?, origin_date = ?, updated_at = ? WHERE id = ?",
    date,
    originDate,
    nowIso(),
    id,
  );
}

/** Open tasks from past days move to today; returns how many moved. */
export async function carryOverToToday(db: SQLiteDatabase, today: string): Promise<number> {
  const result = await db.runAsync(
    `UPDATE tasks SET date = ?, updated_at = ?
     WHERE deleted_at IS NULL AND done = 0 AND date < ?`,
    today,
    nowIso(),
    today,
  );
  return result.changes;
}
