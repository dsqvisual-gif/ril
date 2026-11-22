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
