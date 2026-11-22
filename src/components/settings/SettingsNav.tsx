import Link from "next/link";
import styles from "./SettingsNav.module.css";

type RowProps = {
  href: string;
  icon: string;
  /** Background of the icon tile. */
  tone: string;
  title: string;
  /** Current value, shown on the right: "Светлая", "Включено"… */
  value?: string;
};

/** One line of the settings menu, like on a phone. */
export function SettingsRow({ href, icon, tone, title, value }: RowProps) {
  return (
    <Link href={href} className={styles.row}>
      <span className={styles.icon} style={{ background: tone }} aria-hidden>
        {icon}
      </span>
      <span className={styles.rowTitle}>{title}</span>
      {value ? <span className={styles.value}>{value}</span> : null}
      <span className={styles.chevron} aria-hidden>
        ›
      </span>
    </Link>
  );
}

/** A titled group of settings rows. */
export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className={styles.group}>
      {title ? <h2 className={styles.groupTitle}>{title}</h2> : null}
      <div className={styles.groupBox}>{children}</div>
    </section>
  );
}

/** Frame of a settings section page: back link, title, short explanation. */
export function SettingsPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.page}>
      <Link href="/app/settings" className={styles.back}>
        ‹ Настройки
      </Link>
      <h1 className={styles.pageTitle}>{title}</h1>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
      {children}
    </section>
  );
}
