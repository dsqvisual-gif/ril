import type { Metadata } from "next";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { SettingsPage } from "@/components/settings/SettingsNav";
import { AvatarSettings } from "@/components/settings/AvatarSettings";
import { NameEditor } from "@/components/settings/NameEditor";
import { avatarSrc } from "@/lib/avatar";
import { settingsUser } from "@/lib/settings-user";
import styles from "@/components/settings/Settings.module.css";

export const metadata: Metadata = { title: "Профиль — Uspeyka" };

export default async function ProfileSettings() {
  const user = await settingsUser();
  return (
    <SettingsPage title="Профиль" lead="Как вас видят друзья и команда.">
      <div className={styles.card}>
        <AvatarSettings name={user.name} src={avatarSrc(user)} uploaded={user.avatarVersion > 0} />
        <dl className={styles.list}>
          <div>
            <dt>Имя</dt>
            <dd>
              <NameEditor initial={user.name} />
            </dd>
          </div>
          <div>
            <dt>Ник</dt>
            <dd>{user.username ? `@${user.username}` : "—"}</dd>
          </div>
          <div>
            <dt>Почта</dt>
            <dd>
              {user.email}
              {user.emailVerified ? <span className={styles.ok}> ✓ подтверждена</span> : null}
            </dd>
          </div>
          <div>
            <dt>С нами с</dt>
            <dd>{format(user.createdAt, "d MMMM yyyy", { locale: ru })}</dd>
          </div>
        </dl>
      </div>
    </SettingsPage>
  );
}
