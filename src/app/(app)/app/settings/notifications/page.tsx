import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsNav";
import { DigestSettings } from "@/components/settings/RemindersSettings";
import { settingsUser } from "@/lib/settings-user";

export const metadata: Metadata = { title: "Письма — Uspeyka" };

export default async function NotificationSettings() {
  const user = await settingsUser();
  return (
    <SettingsPage title="Письма" lead={`Приходят на ${user.email}. Отключить можно в любой момент.`}>
      <DigestSettings digestEnabled={user.digestEnabled} healthEmails={user.healthEmails} momMode={user.momMode} />
    </SettingsPage>
  );
}
