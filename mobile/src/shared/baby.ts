// Kept in step with the website: src/lib/baby.ts and src/components/baby/rhythm.ts there.
import { addMonths, differenceInCalendarDays, differenceInMonths, format } from "date-fns";
import { fromDateKey } from "./dates";

export type BabyEventKind = "sleep" | "feed" | "diaper";
export type FeedData = { type: "breast" | "bottle"; side?: "left" | "right"; ml?: number; milk?: "formula" | "breastmilk" };
export type DiaperData = { pee: boolean; poo: boolean };

export type Child = {
  id: string;
  name: string;
  birthDate: string;
  sex: "girl" | "boy" | null;
  isOwner: boolean;
  people: { id: string; name: string }[];
};

export type BabyEvent = {
  id: string;
  kind: BabyEventKind;
  startedAt: string;
  endedAt: string | null;
  data: FeedData | DiaperData | null;
  note: string | null;
  byUserId: string | null;
};

export type Growth = { id: string; date: string; weightG: number | null; heightCm: number | null; headCm: number | null };
export type FoodTry = { id: string; date: string; amount: string | null; reaction: FoodReaction; note: string | null };
export type Food = { id: string; product: string; category: FoodCategory; startDate: string; status: FoodStatus; note: string | null; tries: FoodTry[] };
export type Health = { id: string; kind: "vaccine" | "visit"; title: string; date: string; done: boolean; note: string | null; remindDaysBefore: number };
export type Caregiver = { id: string; name: string; username: string | null; status: "invited" | "active" };
export type ChildInvite = { id: string; childName: string; fromName: string | null };

export function plural(n: number, forms: [string, string, string]): string {
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

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "меньше минуты";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

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

/** Icons are MaterialCommunityIcons names. */
export const FOOD_CATEGORIES: { id: FoodCategory; label: string; icon: string; color: string }[] = [
  { id: "veg", label: "Овощи", icon: "carrot", color: "#2f9e44" },
  { id: "grain", label: "Каши", icon: "bowl-mix-outline", color: "#c48a1b" },
  { id: "fruit", label: "Фрукты", icon: "food-apple-outline", color: "#e8590c" },
  { id: "meat", label: "Мясо и рыба", icon: "food-drumstick-outline", color: "#c2255c" },
  { id: "dairy", label: "Молочное и желток", icon: "egg-outline", color: "#1971c2" },
  { id: "other", label: "Другое", icon: "silverware-fork-knife", color: "#6c757d" },
];

export const FOOD_SUGGESTIONS: Record<FoodCategory, string[]> = {
  veg: ["Кабачок", "Брокколи", "Цветная капуста", "Тыква", "Морковь", "Картофель", "Зелёный горошек"],
  grain: ["Гречка", "Рис", "Кукурузная каша", "Овсянка", "Пшённая каша"],
  fruit: ["Яблоко", "Груша", "Банан", "Чернослив", "Персик", "Абрикос"],
  meat: ["Индейка", "Кролик", "Телятина", "Курица", "Говядина", "Рыба (хек, треска)"],
  dairy: ["Творог", "Кефир", "Йогурт без добавок", "Желток"],
  other: [],
};

export const FOOD_STATUS: Record<FoodStatus, { label: string; icon: string; color: string }> = {
  trying: { label: "Вводим", icon: "clock-outline", color: "#1971c2" },
  ok: { label: "Подходит", icon: "check-circle-outline", color: "#2f9e44" },
  reaction: { label: "Была реакция", icon: "alert-circle-outline", color: "#e03131" },
  later: { label: "Отложили", icon: "pause-circle-outline", color: "#868e96" },
};

export const FOOD_REACTIONS: Record<FoodReaction, string> = {
  none: "Всё хорошо",
  skin: "Сыпь, покраснение",
  tummy: "Животик: колики, стул",
  other: "Другое",
};

export const NEW_FOOD_GAP_DAYS = 3;

export function nextNewFoodDate(starts: string[], gap = NEW_FOOD_GAP_DAYS): string | null {
  if (starts.length === 0) return null;
  const last = starts.reduce((a, b) => (a > b ? a : b));
  const date = fromDateKey(last);
  date.setDate(date.getDate() + gap);
  return format(date, "yyyy-MM-dd");
}

// ---------- rhythm: when the baby is usually ready to sleep and eat ----------

export type RhythmTip = { kind: "sleep" | "feed"; text: string; now: boolean };

const H = 3_600_000;
const SOON = 10 * 60_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function rhythm(events: BabyEvent[], now: number): RhythmTip[] {
  const since = now - 3 * 24 * H;
  const asc = [...events].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const tips: RhythmTip[] = [];

  const sleeps = asc.filter((e) => e.kind === "sleep" && e.endedAt && new Date(e.startedAt).getTime() >= since);
  const wakes: number[] = [];
  for (let i = 1; i < sleeps.length; i++) {
    const gap = new Date(sleeps[i].startedAt).getTime() - new Date(sleeps[i - 1].endedAt!).getTime();
    if (gap > 15 * 60_000 && gap < 6 * H) wakes.push(gap);
  }
  const running = asc.find((e) => e.kind === "sleep" && !e.endedAt);
  const lastSleep = [...sleeps].reverse()[0];
  if (wakes.length >= 3 && !running && lastSleep) {
    const wake = median(wakes);
    const at = new Date(lastSleep.endedAt!).getTime() + wake;
    if (at > now - 2 * H) {
      tips.push({
        kind: "sleep",
        now: at - now < SOON,
        text: at - now < SOON ? `Пора укладывать: обычно бодрствует ~${formatDuration(wake)}` : `Обычно бодрствует ~${formatDuration(wake)} — укладывать около ${format(at, "HH:mm")}`,
      });
    }
  }

  const feeds = asc.filter((e) => e.kind === "feed" && new Date(e.startedAt).getTime() >= since);
  const gaps: number[] = [];
  for (let i = 1; i < feeds.length; i++) {
    const gap = new Date(feeds[i].startedAt).getTime() - new Date(feeds[i - 1].startedAt).getTime();
    if (gap > 30 * 60_000 && gap < 6 * H) gaps.push(gap);
  }
  const feeding = feeds.some((e) => !e.endedAt);
  const lastFeed = feeds[feeds.length - 1];
  if (gaps.length >= 3 && !feeding && lastFeed) {
    const gap = median(gaps);
    const at = new Date(lastFeed.startedAt).getTime() + gap;
    if (at > now - 2 * H) {
      tips.push({
        kind: "feed",
        now: at - now < SOON,
        text: at - now < SOON ? `Скоро кормить: обычно каждые ~${formatDuration(gap)}` : `Кормит обычно каждые ~${formatDuration(gap)} — следующее около ${format(at, "HH:mm")}`,
      });
    }
  }
  return tips;
}

// ---------- stats ----------

const DAY = 86_400_000;
const NIGHT_FROM = 20;
const NIGHT_TO = 8;

export type DayStat = { start: number; daySleep: number; nightSleep: number; feeds: number; pee: number; poo: number };

export function startOfLocalDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function buildStats(events: BabyEvent[], days: number, now: number): DayStat[] {
  const first = startOfLocalDay(now) - (days - 1) * DAY;
  const stats: DayStat[] = Array.from({ length: days }, (_, i) => ({ start: first + i * DAY, daySleep: 0, nightSleep: 0, feeds: 0, pee: 0, poo: 0 }));
  const indexOf = (t: number) => Math.floor((startOfLocalDay(t) - first) / DAY);
  for (const e of events) {
    const start = new Date(e.startedAt).getTime();
    if (e.kind === "sleep") {
      const end = e.endedAt ? new Date(e.endedAt).getTime() : now;
      const hour = new Date(start).getHours();
      const night = hour >= NIGHT_FROM || hour < NIGHT_TO;
      for (let t = start; t < end; ) {
        const dayEnd = startOfLocalDay(t) + DAY;
        const piece = Math.min(end, dayEnd) - t;
        const i = indexOf(t);
        if (i >= 0 && i < days) {
          if (night) stats[i].nightSleep += piece;
          else stats[i].daySleep += piece;
        }
        t = dayEnd;
      }
      continue;
    }
    const i = indexOf(start);
    if (i < 0 || i >= days) continue;
    if (e.kind === "feed") stats[i].feeds += 1;
    else {
      const d = e.data as DiaperData | null;
      if (d?.pee) stats[i].pee += 1;
      if (d?.poo) stats[i].poo += 1;
    }
  }
  return stats;
}
