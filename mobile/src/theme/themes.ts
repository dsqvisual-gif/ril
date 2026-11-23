/** The website's colour themes (src/lib/themes.ts there), same names and accents. */
export type ThemeId = "light" | "dark" | "pink" | "lavender" | "mint" | "peach" | "ocean" | "midnight";

export const THEMES: { id: ThemeId; name: string; swatch: [string, string, string] }[] = [
  { id: "light", name: "Светлая", swatch: ["#f5f7fb", "#ffffff", "#007aff"] },
  { id: "dark", name: "Тёмная", swatch: ["#0f1115", "#1b1e24", "#4c9dff"] },
  { id: "pink", name: "Розовая", swatch: ["#fff0f6", "#ffffff", "#e64980"] },
  { id: "lavender", name: "Лавандовая", swatch: ["#f3f0ff", "#ffffff", "#7950f2"] },
  { id: "mint", name: "Мятная", swatch: ["#ebfbf5", "#ffffff", "#0ca678"] },
  { id: "peach", name: "Персиковая", swatch: ["#fff4e6", "#ffffff", "#f76707"] },
  { id: "ocean", name: "Океан", swatch: ["#e7f5ff", "#ffffff", "#1971c2"] },
  { id: "midnight", name: "Полночь", swatch: ["#0b1530", "#14204a", "#74c0fc"] },
];

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}
