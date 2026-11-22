"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./FriendQr.module.css";

type Props = {
  /** Ready SVG markup of the QR code, made on the server from our own link. */
  svg: string;
  link: string;
  username: string;
};

/** "Add me as a friend" QR code with share and copy buttons. */
export function FriendQr({ svg, link, username }: Props) {
  const [copied, setCopied] = useState(false);
  // Known only in the browser; the server renders without the button.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Скопируйте ссылку:", link);
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: "Uspeyka",
        text: `Добавь меня в друзья в Uspeyka — @${username}`,
        url: link,
      });
    } catch {
      // Closed the share sheet.
    }
  }

  return (
    <div className={styles.wrap}>
      {/* The markup comes from the qrcode library on our server, not from user input. */}
      <div className={styles.qr} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`QR-код: ${link}`} />
      <div className={styles.side}>
        <p className={styles.text}>
          Покажите этот код другу — пусть наведёт камеру телефона. Откроется ваша страница с кнопкой
          «Добавить в друзья».
        </p>
        <p className={styles.link}>{link.replace(/^https?:\/\//, "")}</p>
        <div className={styles.actions}>
          {canShare ? (
            <button type="button" className={styles.primary} onClick={() => void share()}>
              Поделиться
            </button>
          ) : null}
          <button type="button" className={styles.secondary} onClick={() => void copy()}>
            {copied ? "Скопировано ✓" : "Скопировать ссылку"}
          </button>
        </div>
      </div>
    </div>
  );
}
