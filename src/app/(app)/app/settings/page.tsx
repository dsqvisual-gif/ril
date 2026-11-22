import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { DEFAULT_THEME, isThemeId } from "@/lib/themes";
import { replayOnboarding } from "@/lib/actions/onboarding";
import { listReminders } from "@/lib/actions/reminders";
import { DigestSettings, RemindersSettings } from "@/components/settings/RemindersSettings";
import { MomModeSwitch } from "@/components/settings/MomModeSwitch";
import { AvatarSettings } from "@/components/settings/AvatarSettings";
import { NameEditor } from "@/components/settings/NameEditor";
import { FriendQr } from "@/components/settings/FriendQr";
import { friendLink } from "@/lib/friend-link";
import QRCode from "qrcode";
import { avatarSrc } from "@/lib/avatar";
import styles from "@/components/settings/Settings.module.css";

export const metadata: Metadata = {
  title: "Профиль — Uspeyka",
};

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      username: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      createdAt: true,
      theme: true,
      digestEnabled: true,
      momMode: true,
      healthEmails: true,
      id: true,
      image: true,
      avatarVersion: true,
    },
  });
  if (!user) notFound();
  const reminders = await listReminders();
  const link = user.username ? friendLink(user.username) : null;
  const qrSvg = link
    ? await QRCode.toString(link, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 0,
        color: { dark: "#182244", light: "#ffffff" },
      })
    : null;

  return (
    <section className={styles.root}>
      <h1 className={styles.title}>Профиль</h1>

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
            <dt>Вход</dt>
            <dd>{user.passwordHash ? "Пароль, код из письма или Google" : "Google или код из письма"}</dd>
          </div>
          <div>
            <dt>С нами с</dt>
            <dd>{format(user.createdAt, "d MMMM yyyy", { locale: ru })}</dd>
          </div>
        </dl>
        <form action={replayOnboarding}>
          <button type="submit" className={styles.linkBtn}>
            Показать знакомство с приложением ещё раз
          </button>
        </form>
        <p className={styles.hint}>
          Забыли пароль или хотите его сменить — воспользуйтесь{" "}
          <a href="/forgot">восстановлением по коду</a>.
        </p>
      </div>

      {link && qrSvg && user.username ? (
        <div className={styles.card} id="qr">
          <h2 className={styles.cardTitle}>Мой QR для друзей</h2>
          <FriendQr svg={qrSvg} link={link} username={user.username} />
        </div>
      ) : null}

      <MomModeSwitch initial={user.momMode} />

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Оформление</h2>
        <ThemePicker initial={isThemeId(user.theme) ? user.theme : DEFAULT_THEME} />
      </div>

      <DigestSettings
        digestEnabled={user.digestEnabled}
        healthEmails={user.healthEmails}
        momMode={user.momMode}
      />

      <RemindersSettings initialReminders={reminders} />

      <DeleteAccount confirmWord={user.username ? `@${user.username}` : user.email} />
    </section>
  );
}
