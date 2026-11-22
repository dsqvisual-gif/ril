import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsNav";
import { MomModeSwitch } from "@/components/settings/MomModeSwitch";
import { settingsUser } from "@/lib/settings-user";

export const metadata: Metadata = { title: "Режим — Uspeyka" };

export default async function ModesSettings() {
  const user = await settingsUser();
  return (
    <SettingsPage
      title="Режим"
      lead="Обычный режим — планер, цели, друзья и команда. Режим мамы добавляет трекер малыша, а личный планер остаётся рядом."
    >
      <MomModeSwitch initial={user.momMode} />
    </SettingsPage>
  );
}
