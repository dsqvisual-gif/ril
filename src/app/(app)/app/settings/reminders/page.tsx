import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsNav";
import { RemindersSettings } from "@/components/settings/RemindersSettings";
import { listReminders } from "@/lib/actions/reminders";

export const metadata: Metadata = { title: "Регулярные напоминания — Uspeyka" };

export default async function RemindersPage() {
  const reminders = await listReminders();
  return (
    <SettingsPage title="Регулярные напоминания">
      <RemindersSettings initialReminders={reminders} />
    </SettingsPage>
  );
}
