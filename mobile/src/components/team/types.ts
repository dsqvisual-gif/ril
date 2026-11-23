import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { fromDateKey, todayKey } from "@/shared/dates";

export type Role = "owner" | "admin" | "member";
export type Status = "todo" | "doing" | "done";
export type Member = { id: string; userId: string; name: string; username: string | null; role: Role; status: "invited" | "active" };
export type CTask = {
  id: string;
  title: string;
  note: string | null;
  assigneeId: string | null;
  creatorId: string;
  startDate: string;
  deadline: string | null;
  status: Status;
  important: boolean;
  doneAt: string | null;
};
export type TeamView = { company: { id: string; name: string }; me: { userId: string; role: Role }; members: Member[]; tasks: CTask[] };
export type Run = (task: () => Promise<unknown>) => Promise<boolean>;

export const STATUSES: { id: Status; label: string; color: string }[] = [
  { id: "todo", label: "Не начато", color: "#868e96" },
  { id: "doing", label: "В процессе", color: "#f08c00" },
  { id: "done", label: "Готово", color: "#2f9e44" },
];
export const statusOf = (s: Status) => STATUSES.find((x) => x.id === s)!;
export const ROLE: Record<Role, string> = { owner: "Владелец", admin: "Админ", member: "Участник" };
export const isManager = (r: Role) => r === "owner" || r === "admin";

export function plural(n: number, [one, few, many]: [string, string, string]) {
  const d = n % 10;
  const t = n % 100;
  if (d === 1 && t !== 11) return one;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few;
  return many;
}

export function daysLeft(deadline: string): number {
  return differenceInCalendarDays(fromDateKey(deadline), fromDateKey(todayKey()));
}

export type Due = { text: string; tone: "danger" | "warn" | "ok" | "muted" };

export function dueInfo(deadline: string | null, done: boolean): Due | null {
  if (!deadline) return null;
  const date = format(fromDateKey(deadline), "d MMM", { locale: ru });
  if (done) return { text: `до ${date}`, tone: "muted" };
  const d = daysLeft(deadline);
  if (d < 0) return { text: `просрочено на ${-d} ${plural(-d, ["день", "дня", "дней"])}`, tone: "danger" };
  if (d === 0) return { text: "сегодня", tone: "warn" };
  if (d === 1) return { text: "завтра", tone: "warn" };
  if (d <= 6) return { text: `${date}, через ${d} ${plural(d, ["день", "дня", "дней"])}`, tone: "ok" };
  return { text: `до ${date}`, tone: "muted" };
}

export function personName(view: TeamView, userId: string | null): string {
  if (!userId) return "Без исполнителя";
  const m = view.members.find((x) => x.userId === userId);
  if (!m) return "Бывший участник";
  return m.userId === view.me.userId ? `${m.name} (я)` : m.name;
}
