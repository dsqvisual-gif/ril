import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { fromDateKey, todayKey } from "@/lib/dates";

export type DueTone = "dueLate" | "dueSoon" | "dueOk" | "dueDone";

/** Short deadline label and colour for a team task. */
export function deadlineInfo(
  deadline: string | null,
  done: boolean,
  today = todayKey(),
): { text: string; tone: DueTone } | null {
  if (!deadline) return null;
  const date = format(fromDateKey(deadline), "d MMM", { locale: ru });
  if (done) return { text: `до ${date}`, tone: "dueDone" };
  const days = differenceInCalendarDays(fromDateKey(deadline), fromDateKey(today));
  if (days < 0) return { text: `просрочено · ${date}`, tone: "dueLate" };
  if (days === 0) return { text: "дедлайн сегодня", tone: "dueLate" };
  if (days === 1) return { text: "дедлайн завтра", tone: "dueSoon" };
  if (days <= 3) return { text: `через ${days} дн. · ${date}`, tone: "dueSoon" };
  return { text: `до ${date}`, tone: "dueOk" };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export function personName(person: { userId: string; name: string }, meId: string): string {
  return person.userId === meId ? `${person.name} (я)` : person.name;
}

export function isOverdue(task: { deadline: string | null; status: string }, today = todayKey()) {
  return task.status !== "done" && task.deadline !== null && task.deadline < today;
}
