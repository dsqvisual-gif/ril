"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Brand";
import { logoutAction } from "@/lib/actions/logout";
import styles from "./AppHeader.module.css";

const LINKS = [
  { href: "/app", label: "Планер" },
  { href: "/app/goals", label: "Цели" },
  { href: "/app/team", label: "Команда" },
  { href: "/app/friends", label: "Друзья" },
  { href: "/app/achievements", label: "Достижения" },
];

const MOM_LINKS = [
  { href: "/app/baby", label: "Малыш" },
  { href: "/app", label: "Планер" },
  { href: "/app/baby/food", label: "Прикорм" },
  { href: "/app/baby/stats", label: "Статистика" },
];

type Props = {
  name: string;
  username: string | null;
  /** Shows the link to the admin page. */
  isAdmin?: boolean;
  /** Mom mode: a short menu around the baby tracker. */
  momMode?: boolean;
};

function isActive(href: string, pathname: string) {
  // These have their own sections under them in the menu, so only an exact match counts.
  if (href === "/app" || href === "/app/baby") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader({ name, username, isAdmin = false, momMode = false }: Props) {
  const base = momMode ? MOM_LINKS : LINKS;
  const links = isAdmin ? [...base, { href: "/app/admin", label: "Админ" }] : base;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);

  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={styles.header}>
      <Brand href={momMode ? "/app/baby" : "/app"} />
      <nav className={styles.nav} aria-label="Разделы">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isActive(link.href, pathname) ? styles.active : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className={styles.user}>
        <Link href="/app/settings" className={styles.identity} title="Профиль">
          <span className={styles.personName}>{name}</span>
          {username ? <span className={styles.nick}>@{username}</span> : null}
        </Link>
        <form action={logoutAction}>
          <button type="submit" className={styles.logout}>
            Выйти
          </button>
        </form>
      </div>
      <button
        type="button"
        className={`${styles.burger} ${open ? styles.burgerOpen : ""}`}
        aria-expanded={open}
        aria-controls="app-menu"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>
      {open ? (
        <div id="app-menu" className={styles.sheet}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link.href, pathname) ? styles.sheetActive : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/app/settings"
            className={styles.sheetUser}
            onClick={() => setOpen(false)}
          >
            <span className={styles.personName}>{name}</span>
            {username ? <span className={styles.nick}>@{username}</span> : null}
            <span className={styles.profileHint}>Профиль и настройки</span>
          </Link>
          <form action={logoutAction}>
            <button type="submit" className={styles.sheetLogout}>
              Выйти
            </button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
