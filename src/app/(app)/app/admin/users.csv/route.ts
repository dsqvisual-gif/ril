import { format } from "date-fns";
import { requireAdmin } from "@/lib/admin";
import { formatAdminDate, listAdminUsers } from "@/lib/admin-users";

function cell(value: string | number | boolean): string {
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** All users as CSV that Excel and Google Sheets open with Cyrillic intact. */
export async function GET() {
  await requireAdmin();
  const users = await listAdminUsers();
  const header = [
    "Имя",
    "Ник",
    "Email",
    "Дата регистрации",
    "Вход",
    "Почта подтверждена",
    "Последний визит",
    "Минут в приложении",
    "Дней активности",
    "Дел",
    "Целей",
    "Друзей",
    "Компаний",
  ];
  const rows = users.map((u) => [
    u.name,
    u.username ? `@${u.username}` : "",
    u.email,
    formatAdminDate(u.createdAt, "csv"),
    u.method,
    u.emailVerified ? "да" : "нет",
    u.lastSeenAt ? formatAdminDate(u.lastSeenAt, "csv") : "",
    u.activeMinutes,
    u.activeDays,
    u.tasks,
    u.goals,
    u.friends,
    u.companies,
  ]);
  // Semicolons and a BOM: what Russian-locale Excel expects.
  const body = "﻿" + [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uspeyka-users-${format(new Date(), "yyyy-MM-dd")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
