import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsNav";
import { logoutAction } from "@/lib/actions/logout";
import { avatarSrc } from "@/lib/avatar";
import { settingsUser } from "@/lib/settings-user";
import { THEMES } from "@/lib/themes";
import styles from "@/components/settings/SettingsHub.module.css";

export const metadata: Metadata = {
  title: "Настройки — Uspeyka",
};

export default async function SettingsHub() {
  const user = await settingsUser();
  const theme = THEMES.find((t) => t.id === user.theme)?.name ?? "Светлая";
  const reminders = user._count.reminders;

  return (
    <section className={styles.root}>
      <h1 className={styles.title}>Настройки</h1>

      <Link href="/app/settings/profile" className={styles.profile}>
        <Avatar src={avatarSrc(user)} name={user.name} size={52} />
        <span className={styles.who}>
          <b>{user.name}</b>
          <span>{user.username ? `@${user.username}` : user.email}</span>
        </span>
        <span className={styles.edit}>Профиль ›</span>
      </Link>

      <SettingsGroup title="Приложение">
        <SettingsRow
          href="/app/settings/modes"
          icon={user.momMode ? "🤱" : "🗓️"}
          tone="#ffe3ef"
          title="Режим"
          value={user.momMode ? "Режим мамы" : "Обычный"}
        />
        <SettingsRow href="/app/settings/appearance" icon="🎨" tone="#e7e4ff" title="Оформление" value={theme} />
      </SettingsGroup>

      <SettingsGroup title="Уведомления">
        <SettingsRow
          href="/app/settings/notifications"
          icon="✉️"
          tone="#dff1ff"
          title="Письма"
          value={user.digestEnabled ? "Утренний план вкл." : "Выключены"}
        />
        <SettingsRow
          href="/app/settings/reminders"
          icon="🔁"
          tone="#ddf7e8"
          title="Регулярные напоминания"
          value={reminders > 0 ? String(reminders) : "Нет"}
        />
      </SettingsGroup>

      <SettingsGroup title="Друзья">
        <SettingsRow href="/app/settings/qr" icon="📱" tone="#fff1d6" title="Мой QR для друзей" />
      </SettingsGroup>

      <SettingsGroup title="Аккаунт">
        <SettingsRow href="/app/settings/account" icon="🔒" tone="#eceef3" title="Вход и безопасность" />
        <SettingsRow href="/app/settings/about" icon="💡" tone="#fff6c7" title="Помощь и документы" />
      </SettingsGroup>

      <form action={logoutAction}>
        <button type="submit" className={styles.logout}>
          Выйти из аккаунта
        </button>
      </form>
    </section>
  );
}
