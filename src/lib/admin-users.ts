import { prisma } from "@/lib/prisma";

export type AdminUserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  createdAt: Date;
  method: "Пароль" | "Google";
  emailVerified: boolean;
  lastSeenAt: Date | null;
  activeMinutes: number;
  activeDays: number;
  tasks: number;
  goals: number;
  friends: number;
  companies: number;
};

/** Every account, newest first, with a few activity counts. */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      createdAt: true,
      passwordHash: true,
      emailVerified: true,
      lastSeenAt: true,
      activeMinutes: true,
      activeDays: true,
      _count: {
        select: {
          tasks: true,
          goals: true,
          sentRequests: { where: { status: "accepted" } },
          receivedRequests: { where: { status: "accepted" } },
          companies: { where: { status: "active" } },
        },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    createdAt: u.createdAt,
    method: u.passwordHash ? "Пароль" : "Google",
    emailVerified: Boolean(u.emailVerified),
    lastSeenAt: u.lastSeenAt,
    activeMinutes: u.activeMinutes,
    activeDays: u.activeDays,
    tasks: u._count.tasks,
    goals: u._count.goals,
    friends: u._count.sentRequests + u._count.receivedRequests,
    companies: u._count.companies,
  }));
}

/** Admin dates in Kazakhstan time: servers run on UTC. */
const ADMIN_TIME_ZONE = "Asia/Almaty";

export function formatAdminDate(date: Date, style: "table" | "csv"): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: ADMIN_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return style === "csv"
    ? `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
    : `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Headline numbers for the admin page. */
export function adminStats(users: AdminUserRow[], now = new Date()) {
  // "Today" means since midnight in Kazakhstan; longer windows count back from now.
  const today = formatAdminDate(now, "csv").slice(0, 10);
  const since = (days: number) =>
    users.filter((u) => now.getTime() - u.createdAt.getTime() < days * 86_400_000).length;
  return [
    { label: "Всего пользователей", value: users.length },
    {
      label: "Новых сегодня",
      value: users.filter((u) => formatAdminDate(u.createdAt, "csv").startsWith(today)).length,
    },
    { label: "За 7 дней", value: since(7) },
    { label: "За 30 дней", value: since(30) },
    {
      label: "Заходили сегодня",
      value: users.filter(
        (u) => u.lastSeenAt && formatAdminDate(u.lastSeenAt, "csv").startsWith(today),
      ).length,
    },
    {
      label: "Активны за 7 дней",
      value: users.filter((u) => u.lastSeenAt && now.getTime() - u.lastSeenAt.getTime() < 7 * 86_400_000).length,
    },
    {
      label: "Не заходят 30+ дней",
      value: users.filter((u) => u.lastSeenAt && now.getTime() - u.lastSeenAt.getTime() >= 30 * 86_400_000).length,
    },
    { label: "Через Google", value: users.filter((u) => u.method === "Google").length },
    { label: "Создали хотя бы одно дело", value: users.filter((u) => u.tasks > 0).length },
  ];
}

/** "3 ч 20 мин" style duration. */
export function formatMinutes(total: number): string {
  if (total <= 0) return "—";
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}
