import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import { addDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Store } from "@/db/store-types";
import type { Task } from "@/account/api";
import { toDateKey } from "@/shared/dates";

/**
 * Pop-up notifications on the phone. They are scheduled on the phone itself from the
 * account's data (tasks with a time, the day's plan, reminders, vaccinations, team
 * deadlines), so they need no e-mail and work without internet once planned.
 */

export const NOTIFY_SUPPORTED = Platform.OS !== "web";

export type NotifyPrefs = {
  /** Minutes before a task with a time; -1 turns these off. */
  before: number;
  /** "09:00" — the day's plan in the morning; "" turns it off. */
  morning: string;
  /** "21:00" — what is left unfinished in the evening; "" turns it off. */
  evening: string;
  reminders: boolean;
  team: boolean;
  baby: boolean;
};

export const DEFAULT_PREFS: NotifyPrefs = { before: 10, morning: "09:00", evening: "21:00", reminders: true, team: true, baby: true };

const KEY = "notify_prefs";

export async function readPrefs(store: Store): Promise<NotifyPrefs> {
  try {
    const raw = await store.getSetting(KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifyPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function writePrefs(store: Store, prefs: NotifyPrefs): Promise<void> {
  await store.setSetting(KEY, JSON.stringify(prefs));
}

let configured = false;

/** Shows notifications as banners even while the app is open; sets up the Android channel. */
export async function configureNotifications() {
  if (!NOTIFY_SUPPORTED || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Дела и напоминания",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: "#007aff",
    });
  }
}

export type Permission = "granted" | "denied" | "undetermined" | "unsupported";

export async function permission(): Promise<Permission> {
  if (!NOTIFY_SUPPORTED) return "unsupported";
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}

export async function askPermission(): Promise<Permission> {
  if (!NOTIFY_SUPPORTED) return "unsupported";
  await configureNotifications();
  const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  if (p.granted) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}

// ---------- what to plan ----------

export type NotifyData = {
  tasks: Task[];
  reminders: { id: string; title: string; nextDate: string; remindDaysBefore: number }[];
  team: { id: string; title: string; deadline: string | null; company: string }[];
  health: { id: string; title: string; date: string; done: boolean; remindDaysBefore: number; child: string }[];
};

type Planned = { at: Date; title: string; body: string; url: string };

function atTime(dateKey: string, hhmm: string): Date {
  return new Date(`${dateKey}T${hhmm}:00`);
}

function plural(n: number, forms: [string, string, string]) {
  const d = n % 10;
  const t = n % 100;
  if (d === 1 && t !== 11) return forms[0];
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return forms[1];
  return forms[2];
}

export function plan(data: NotifyData, prefs: NotifyPrefs, now = new Date()): Planned[] {
  const out: Planned[] = [];
  const days = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(now, i)));
  const open = data.tasks.filter((t) => !t.done);

  if (prefs.before >= 0) {
    for (const t of open) {
      if (!t.time) continue;
      const at = new Date(atTime(t.date, t.time).getTime() - prefs.before * 60_000);
      out.push({
        at,
        title: t.title,
        body: prefs.before === 0 ? `Сейчас, ${t.time}` : `В ${t.time} — через ${prefs.before} мин`,
        url: "/",
      });
    }
  }

  for (const day of days) {
    const list = open.filter((t) => t.date === day);
    if (prefs.morning && list.length) {
      const first = [...list].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99")).slice(0, 3).map((t) => (t.time ? `${t.time} ${t.title}` : t.title));
      out.push({
        at: atTime(day, prefs.morning),
        title: `На ${day === days[0] ? "сегодня" : format(new Date(`${day}T12:00:00`), "EEEE", { locale: ru })} ${list.length} ${plural(list.length, ["дело", "дела", "дел"])}`,
        body: first.join(" · ") + (list.length > 3 ? " …" : ""),
        url: "/",
      });
    }
    if (prefs.evening && list.length) {
      out.push({
        at: atTime(day, prefs.evening),
        title: "Как прошёл день?",
        body: `Отметьте, что сделано. Невыполненное завтра перенесётся само.`,
        url: "/",
      });
    }
  }

  if (prefs.reminders) {
    for (const r of data.reminders) {
      const day = toDateKey(addDays(new Date(`${r.nextDate}T12:00:00`), -r.remindDaysBefore));
      out.push({
        at: atTime(day, "10:00"),
        title: r.title,
        body: r.remindDaysBefore === 0 ? "Сегодня" : `${format(new Date(`${r.nextDate}T12:00:00`), "d MMMM", { locale: ru })} — через ${r.remindDaysBefore} ${plural(r.remindDaysBefore, ["день", "дня", "дней"])}`,
        url: "/settings/notifications",
      });
    }
  }

  if (prefs.team) {
    for (const t of data.team) {
      if (!t.deadline) continue;
      out.push({ at: atTime(toDateKey(addDays(new Date(`${t.deadline}T12:00:00`), -1)), "17:00"), title: `Завтра срок: ${t.title}`, body: t.company, url: "/team" });
      out.push({ at: atTime(t.deadline, "09:30"), title: `Сегодня срок: ${t.title}`, body: t.company, url: "/team" });
    }
  }

  if (prefs.baby) {
    for (const h of data.health) {
      if (h.done) continue;
      const day = toDateKey(addDays(new Date(`${h.date}T12:00:00`), -h.remindDaysBefore));
      out.push({ at: atTime(day, "10:00"), title: h.title, body: `${h.child} · ${format(new Date(`${h.date}T12:00:00`), "d MMMM", { locale: ru })}`, url: "/settings/health" });
    }
  }

  // Only the future, nearest first; phones keep a limited number of planned notifications.
  return out.filter((p) => p.at.getTime() > now.getTime() + 30_000).sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60);
}

/** Replaces everything planned on the phone with a fresh plan. */
export async function schedule(planned: Planned[]): Promise<number> {
  if (!NOTIFY_SUPPORTED) return 0;
  await configureNotifications();
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: { url: p.url }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: "default" },
    });
  }
  return planned.length;
}

export async function clearAll() {
  if (NOTIFY_SUPPORTED) await Notifications.cancelAllScheduledNotificationsAsync();
}

// ---------- asking for a fresh plan after changes ----------

const listeners = new Set<() => void>();

/** Screens call this after a change; the sync waits a moment and plans again. */
export function notifyChanged() {
  for (const l of listeners) l();
}

export function onNotifyChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
