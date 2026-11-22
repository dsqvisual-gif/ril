import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays } from "date-fns";
import { fromDateKey, toDateKey } from "@/lib/dates";

export type RepeatUnit = "day" | "week" | "month" | "year";

export const REPEAT_UNITS: RepeatUnit[] = ["day", "week", "month", "year"];

/** Ready-made choices; "N times a year" becomes every 12/N months. */
export const REPEAT_PRESETS: { id: string; label: string; count: number; unit: RepeatUnit }[] = [
  { id: "week", label: "Каждую неделю", count: 1, unit: "week" },
  { id: "month", label: "Каждый месяц", count: 1, unit: "month" },
  { id: "quarter", label: "4 раза в год (раз в 3 месяца)", count: 3, unit: "month" },
  { id: "half", label: "2 раза в год (раз в полгода)", count: 6, unit: "month" },
  { id: "year", label: "Раз в год", count: 1, unit: "year" },
];

export const REMIND_BEFORE: { days: number; label: string }[] = [
  { days: 0, label: "в тот же день" },
  { days: 1, label: "за 1 день" },
  { days: 3, label: "за 3 дня" },
  { days: 7, label: "за неделю" },
  { days: 14, label: "за 2 недели" },
  { days: 30, label: "за месяц" },
];

export function isRepeatUnit(value: unknown): value is RepeatUnit {
  return REPEAT_UNITS.includes(value as RepeatUnit);
}

export function shiftOccurrence(dateKey: string, count: number, unit: RepeatUnit): string {
  const date = fromDateKey(dateKey);
  const next =
    unit === "day"
      ? addDays(date, count)
      : unit === "week"
        ? addWeeks(date, count)
        : unit === "month"
          ? addMonths(date, count)
          : addYears(date, count);
  return toDateKey(next);
}

/** The first occurrence on or after `today`. */
export function catchUp(nextDate: string, today: string, count: number, unit: RepeatUnit): string {
  let date = nextDate;
  for (let i = 0; date < today && i < 5000; i++) date = shiftOccurrence(date, count, unit);
  return date;
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

const UNIT_FORMS: Record<RepeatUnit, [string, string, string]> = {
  day: ["день", "дня", "дней"],
  week: ["неделю", "недели", "недель"],
  month: ["месяц", "месяца", "месяцев"],
  year: ["год", "года", "лет"],
};

/** "каждые 3 месяца", "каждую неделю", "4 раза в год". */
export function describeRepeat(count: number, unit: RepeatUnit): string {
  const preset = REPEAT_PRESETS.find((p) => p.count === count && p.unit === unit);
  if (preset) return preset.label.replace(/ \(.*\)$/, "").toLowerCase();
  const word = plural(count, UNIT_FORMS[unit]);
  const every = count % 10 === 1 && count % 100 !== 11 ? (unit === "week" ? "каждую" : "каждый") : "каждые";
  return `${every} ${count} ${word}`;
}

/** "сегодня", "завтра", "через 5 дней". */
export function describeIn(today: string, date: string): string {
  const days = differenceInCalendarDays(fromDateKey(date), fromDateKey(today));
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  return `через ${days} ${plural(days, ["день", "дня", "дней"])}`;
}

/** Today's date key in a time zone (falls back to Kazakhstan time). */
export function todayIn(timeZone: string | null | undefined, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "Asia/Almaty" }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(now);
  }
}
