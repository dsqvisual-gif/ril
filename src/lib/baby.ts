import { differenceInCalendarDays, differenceInMonths, addMonths } from "date-fns";
import { fromDateKey } from "@/lib/dates";

export type BabyEventKind = "sleep" | "feed" | "diaper";
export type FeedType = "breast" | "bottle";
export type BreastSide = "left" | "right";

export type FeedData = { type: FeedType; side?: BreastSide; ml?: number; milk?: "formula" | "breastmilk" };
export type DiaperData = { pee: boolean; poo: boolean };

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** "4 мес 12 дн", "1 год 2 мес", "10 дней". */
export function childAge(birthDate: string, today: string): string {
  const birth = fromDateKey(birthDate);
  const now = fromDateKey(today);
  const months = differenceInMonths(now, birth);
  if (months < 1) {
    const days = Math.max(0, differenceInCalendarDays(now, birth));
    return `${days} ${plural(days, ["день", "дня", "дней"])}`;
  }
  const days = differenceInCalendarDays(now, addMonths(birth, months));
  if (months < 12) return `${months} мес${days > 0 ? ` ${days} дн` : ""}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} ${plural(years, ["год", "года", "лет"])}${rest ? ` ${rest} мес` : ""}`;
}

export function childMonths(birthDate: string, today: string): number {
  return differenceInMonths(fromDateKey(today), fromDateKey(birthDate));
}

/** "1 ч 20 мин", "45 мин", "меньше минуты". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "меньше минуты";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

/** "02:15" stopwatch text. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

// ---------- complementary foods ----------

export type FoodCategory = "veg" | "grain" | "fruit" | "meat" | "dairy" | "other";
export type FoodStatus = "trying" | "ok" | "reaction" | "later";
export type FoodReaction = "none" | "skin" | "tummy" | "other";

export const FOOD_CATEGORIES: { id: FoodCategory; label: string; icon: string }[] = [
  { id: "veg", label: "Овощи", icon: "🥦" },
  { id: "grain", label: "Каши", icon: "🥣" },
  { id: "fruit", label: "Фрукты", icon: "🍐" },
  { id: "meat", label: "Мясо и рыба", icon: "🍗" },
  { id: "dairy", label: "Молочное и желток", icon: "🥛" },
  { id: "other", label: "Другое", icon: "🍽️" },
];

/** Usual first foods, roughly in the order they are often introduced. */
export const FOOD_SUGGESTIONS: Record<FoodCategory, string[]> = {
  veg: ["Кабачок", "Брокколи", "Цветная капуста", "Тыква", "Морковь", "Картофель", "Зелёный горошек"],
  grain: ["Гречка", "Рис", "Кукурузная каша", "Овсянка", "Пшённая каша"],
  fruit: ["Яблоко", "Груша", "Банан", "Чернослив", "Персик", "Абрикос"],
  meat: ["Индейка", "Кролик", "Телятина", "Курица", "Говядина", "Рыба (хек, треска)"],
  dairy: ["Творог", "Кефир", "Йогурт без добавок", "Желток"],
  other: [],
};

export const FOOD_STATUS: Record<FoodStatus, { label: string; icon: string }> = {
  trying: { label: "Вводим", icon: "🕐" },
  ok: { label: "Подходит", icon: "✅" },
  reaction: { label: "Была реакция", icon: "⚠️" },
  later: { label: "Отложили", icon: "⏸️" },
};

export const FOOD_REACTIONS: Record<FoodReaction, string> = {
  none: "Всё хорошо",
  skin: "Сыпь, покраснение",
  tummy: "Животик: колики, стул",
  other: "Другое",
};

/** Days between new foods most guides suggest, so a reaction can be traced. */
export const NEW_FOOD_GAP_DAYS = 3;

/** Date key from which the next new food can start, or null if any day is fine. */
export function nextNewFoodDate(starts: string[], gap = NEW_FOOD_GAP_DAYS): string | null {
  if (starts.length === 0) return null;
  const last = starts.reduce((a, b) => (a > b ? a : b));
  const date = fromDateKey(last);
  date.setDate(date.getDate() + gap);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isFoodCategory(value: unknown): value is FoodCategory {
  return FOOD_CATEGORIES.some((c) => c.id === value);
}

export function isFoodStatus(value: unknown): value is FoodStatus {
  return value === "trying" || value === "ok" || value === "reaction" || value === "later";
}

export function isFoodReaction(value: unknown): value is FoodReaction {
  return value === "none" || value === "skin" || value === "tummy" || value === "other";
}
