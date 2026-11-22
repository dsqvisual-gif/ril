import type { Metadata } from "next";
import QRCode from "qrcode";
import { SettingsPage } from "@/components/settings/SettingsNav";
import { FriendQr } from "@/components/settings/FriendQr";
import { friendLink } from "@/lib/friend-link";
import { settingsUser } from "@/lib/settings-user";
import styles from "@/components/settings/Settings.module.css";

export const metadata: Metadata = { title: "Мой QR — Uspeyka" };

export default async function QrSettings() {
  const user = await settingsUser();
  const link = user.username ? friendLink(user.username) : null;
  const svg = link
    ? await QRCode.toString(link, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 0,
        color: { dark: "#182244", light: "#ffffff" },
      })
    : null;
  return (
    <SettingsPage title="Мой QR для друзей">
      <div className={styles.card}>
        {link && svg && user.username ? (
          <FriendQr svg={svg} link={link} username={user.username} />
        ) : (
          <p className={styles.hint}>Сначала выберите ник — QR-код ведёт на страницу с ним.</p>
        )}
      </div>
    </SettingsPage>
  );
}
