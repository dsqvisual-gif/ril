import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function fromDateKey(key: string): Date {
  return parseISO(key);
}

export function formatDayTitle(key: string): string {
  return format(fromDateKey(key), "d MMMM yyyy, EEEE", { locale: ru });
}

export function relativeDayName(key: string, today = todayKey()): string | null {
  const diff = differenceInCalendarDays(fromDateKey(key), fromDateKey(today));
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === 2) return "Послезавтра";
  if (diff === -1) return "Вчера";
  if (diff === -2) return "Позавчера";
  return null;
}

export function numericDayLabel(key: string): string {
  return format(fromDateKey(key), "d.MM");
}

export function plannerNavLabel(key: string, today = todayKey()): string {
  return relativeDayName(key, today) ?? numericDayLabel(key);
}

export function plannerDayHeading(key: string, today = todayKey()): string {
  return relativeDayName(key, today) ?? format(fromDateKey(key), "d MMMM", { locale: ru });
}

export function formatShortDay(key: string): string {
  return format(fromDateKey(key), "EEE d", { locale: ru });
}

export function formatMonthTitle(key: string): string {
  return format(fromDateKey(key), "LLLL yyyy", { locale: ru });
}

export function getWeekDays(anchorKey: string): string[] {
  const anchor = fromDateKey(anchorKey);
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

export function getMonthGrid(anchorKey: string): string[] {
  const anchor = fromDateKey(anchorKey);
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

export function shiftDateKey(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days));
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function resolveToday(input: string, serverToday = todayKey()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return serverToday;
  const diff = Math.abs(
    differenceInCalendarDays(fromDateKey(input), fromDateKey(serverToday)),
  );
  return diff <= 1 ? input : serverToday;
}

export function isLingering(originDate: string, keptOn: string | null, today: string): boolean {
  const anchor = keptOn && keptOn > originDate ? keptOn : originDate;
  return differenceInCalendarDays(fromDateKey(today), fromDateKey(anchor)) >= 2;
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}
