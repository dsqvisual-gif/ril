export const USERNAME_RE = /^[a-z0-9_Ѐ-ӿ]{3,20}$/;

const LATIN = /[a-z]/;
const CYRILLIC = /[Ѐ-ӿ]/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function usernameError(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (!USERNAME_RE.test(username)) {
    return "Ник: 3–20 символов, буквы, цифры и _";
  }
  if (LATIN.test(username) && CYRILLIC.test(username)) {
    return "В нике нельзя смешивать русские и латинские буквы";
  }
  return null;
}

// Characters that look the same on screen collapse to one letter, so that
// "danil", "dаnil" (Cyrillic а), "dan_il" and "dan1l" count as one nickname.
const LOOKALIKE: Record<string, string> = {
  а: "a",
  в: "b",
  е: "e",
  ё: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x",
  і: "i",
  ј: "j",
  ѕ: "s",
  "0": "o",
  "1": "l",
  i: "l",
};

/** The form two nicknames share when people could mistake one for the other. */
export function usernameKey(raw: string): string {
  let key = "";
  for (const ch of normalizeUsername(raw)) {
    if (ch === "_") continue;
    key += LOOKALIKE[ch] ?? ch;
  }
  return key;
}

export function suggestUsername(name: string): string {
  const base = normalizeUsername(name).replace(/[^a-z0-9_Ѐ-ӿ]/g, "");
  if (base.length >= 3 && !(LATIN.test(base) && CYRILLIC.test(base))) return base.slice(0, 20);
  return "";
}
