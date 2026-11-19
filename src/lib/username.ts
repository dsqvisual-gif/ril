export const USERNAME_RE = /^[a-z0-9_\u0400-\u04FF]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function usernameError(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (!USERNAME_RE.test(username)) {
    return "Ник: 3–20 символов, буквы, цифры и _";
  }
  return null;
}

export function suggestUsername(name: string): string {
  const base = normalizeUsername(name).replace(/[^a-z0-9_\u0400-\u04FF]/g, "");
  if (base.length >= 3) return base.slice(0, 20);
  return "";
}
