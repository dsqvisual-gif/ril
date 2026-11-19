"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Brand";
import { logoutAction } from "@/lib/actions/logout";
import styles from "./AppHeader.module.css";

const LINKS = [
  { href: "/app", label: "Планер" },
  { href: "/app/friends", label: "Друзья" },
  { href: "/app/achievements", label: "Достижения" },
];

const ARCHIVE = { href: "/app/archive", label: "Архив" };

type Props = {
  name: string;
  username: string | null;
};

function isActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader({ name, username }: Props) {
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
      <Brand href="/app" />
      <nav className={styles.nav} aria-label="Разделы">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isActive(link.href, pathname) ? styles.active : undefined}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href={ARCHIVE.href}
          className={`${styles.quiet} ${isActive(ARCHIVE.href, pathname) ? styles.quietActive : ""}`}
        >
          {ARCHIVE.label}
        </Link>
      </nav>
      <div className={styles.user}>
        <span className={styles.identity}>
          <span className={styles.personName}>{name}</span>
          {username ? <span className={styles.nick}>@{username}</span> : null}
        </span>
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
          {LINKS.map((link) => (
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
            href={ARCHIVE.href}
            className={`${styles.sheetQuiet} ${isActive(ARCHIVE.href, pathname) ? styles.sheetQuietActive : ""}`}
            onClick={() => setOpen(false)}
          >
            {ARCHIVE.label}
          </Link>
          <div className={styles.sheetUser}>
            <span className={styles.personName}>{name}</span>
            {username ? <span className={styles.nick}>@{username}</span> : null}
          </div>
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
