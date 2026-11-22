/** The Uspeyka website, which the app signs in to. */
export const SITE = process.env.EXPO_PUBLIC_API_URL || "https://www.uspeyka.com";

export type AccountUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatar: string | null;
  momMode: boolean;
};

export type Session = { token: string; user: AccountUser };

export class ApiError extends Error {}

type Result<T> = T & { error?: string };

async function call<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SITE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
  }
  const data = (await res.json().catch(() => ({}))) as Result<T>;
  if (!res.ok || data.error) throw new ApiError(data.error || "Что-то пошло не так. Попробуйте ещё раз.");
  return data;
}

export type AuthAction =
  | "login"
  | "register-start"
  | "register-confirm"
  | "code-start"
  | "code-confirm"
  | "reset-start"
  | "reset-confirm"
  | "resend"
  | "exchange";

/** Sign-in steps; the ones that finish signing in return a session. */
export function auth<T = Session>(action: AuthAction, body: Record<string, unknown>): Promise<T> {
  return call<T>(`/api/mobile/auth/${action}`, { method: "POST", body: JSON.stringify(body) });
}

export async function fetchMe(token: string): Promise<AccountUser | null> {
  try {
    const data = await call<{ user: AccountUser }>("/api/mobile/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.user;
  } catch (error) {
    // 401: the token no longer works (signed out or account deleted).
    if (error instanceof ApiError && /unauthorized/i.test(error.message)) return null;
    throw error;
  }
}

/** Thrown when the website no longer accepts the sign-in: the app signs out. */
export class SignedOutError extends ApiError {}

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function isActionResult(value: unknown): value is ActionResult<unknown> {
  return Boolean(value) && typeof value === "object" && "ok" in (value as object);
}

/**
 * Calls one of the website's own actions (see /api/mobile/rpc on the site).
 * Results in the website's { ok, data | error } shape are unwrapped.
 */
export async function rpc<T>(token: string, fn: string, ...args: unknown[]): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SITE}/api/mobile/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fn, args }),
    });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте интернет.");
  }
  const data = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (res.status === 401) throw new SignedOutError("Войдите в аккаунт ещё раз");
  if (!res.ok || data.error) throw new ApiError(data.error || "Что-то пошло не так");
  const result = data.result;
  if (isActionResult(result)) {
    if (!result.ok) throw new ApiError(result.error);
    return result.data as T;
  }
  return result as T;
}

// ---- data shapes, as the website returns them ----

export type Person = { id: string; name: string; username: string };

export type TaskItem = { id: string; text: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  date: string;
  originDate: string;
  keptOn: string | null;
  time: string | null;
  important: boolean;
  urgent: boolean;
  done: boolean;
  shared: boolean;
  viewerIsOwner: boolean;
  ownerName: string | null;
  partners: Person[];
  note: string | null;
  items: TaskItem[];
};

export type TaskInput = {
  title: string;
  date: string;
  time?: string | null;
  important?: boolean;
  urgent?: boolean;
  friendIds?: string[];
  note?: string | null;
  items?: { text: string; done?: boolean }[];
};

export type ToggleResult = { task: Task; newlyUnlocked: string[] };

export type FriendOption = { id: string; name: string; username: string; alias: string | null; avatar: string | null };

export type AccountRow = {
  id: string;
  name: string;
  username: string;
  alias: string | null;
  avatar: string | null;
  relation: "none" | "friend" | "incoming" | "outgoing";
  friendshipId: string | null;
};

export type FriendsBoard = { me: { id: string; name: string; username: string }; accounts: AccountRow[] };
