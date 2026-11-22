import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsNav";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { settingsUser } from "@/lib/settings-user";
import styles from "@/components/settings/Settings.module.css";

export const metadata: Metadata = { title: "Вход и безопасность — Uspeyka" };

export default async function AccountSettings() {
  const user = await settingsUser();
  return (
    <SettingsPage title="Вход и безопасность">
      <div className={styles.card}>
        <dl className={styles.list}>
          <div>
            <dt>Почта</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Как войти</dt>
            <dd>{user.passwordHash ? "Пароль, код из письма или Google" : "Google или код из письма"}</dd>
          </div>
        </dl>
        <p className={styles.hint}>
          {user.passwordHash ? "Сменить пароль" : "Задать пароль"} можно через{" "}
          <a href="/forgot">восстановление по коду</a> — код придёт на почту.
        </p>
      </div>
      <DeleteAccount confirmWord={user.username ? `@${user.username}` : user.email} />
    </SettingsPage>
  );
}
