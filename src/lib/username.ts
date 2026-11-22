/** Nicknames: 3–20 Latin letters, digits or _. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Russian and Kazakh letters spelled in Latin, for suggestions and old nicknames. */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "q", ң: "n", ө: "o", ұ: "u", ү: "u",
  һ: "h", і: "i",
};

export function transliterate(raw: string): string {
  return [...raw.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "_");
}

export function usernameError(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (/[^\x00-\x7f]/.test(username)) {
    return "Ник пишется только английскими буквами — например, danil";
  }
  if (!USERNAME_RE.test(username)) {
    return "Ник: 3–20 символов — английские буквы, цифры и _";
  }
  return null;
}

// Characters that look alike collapse to one, so "danil", "dan_il", "dan1l"
// and "dani1" count as one nickname.
const LOOKALIKE: Record<string, string> = { "0": "o", "1": "l", i: "l" };

/** The form two nicknames share when people could mistake one for the other. */
export function usernameKey(raw: string): string {
  let key = "";
  for (const ch of transliterate(normalizeUsername(raw))) {
    if (ch === "_") continue;
    key += LOOKALIKE[ch] ?? ch;
  }
  return key;
}

/** A Latin nickname made from a name ("Данил Гогуля" → "danil_gogulya"). */
export function suggestUsername(name: string): string {
  const base = transliterate(normalizeUsername(name)).replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return base.length >= 3 ? base : "";
}
