import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsNav";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { DEFAULT_THEME, isThemeId } from "@/lib/themes";
import { settingsUser } from "@/lib/settings-user";
import styles from "@/components/settings/Settings.module.css";

export const metadata: Metadata = { title: "Оформление — Uspeyka" };

export default async function AppearanceSettings() {
  const user = await settingsUser();
  return (
    <SettingsPage title="Оформление" lead="Цвет фона и акцентов. Сохраняется для всех ваших устройств.">
      <div className={styles.card}>
        <ThemePicker initial={isThemeId(user.theme) ? user.theme : DEFAULT_THEME} />
      </div>
    </SettingsPage>
  );
}
