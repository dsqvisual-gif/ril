import Link from "next/link";
import { Brand } from "@/components/Brand";
import { LEGAL_UPDATED } from "@/lib/site";
import styles from "./LegalPage.module.css";

type Props = {
  title: string;
  lead: string;
  children: React.ReactNode;
};

export function LegalPage({ title, lead, children }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand href="/" />
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
        <p className={styles.updated}>Редакция от {LEGAL_UPDATED}</p>
        <article className={styles.body}>{children}</article>
      </main>
      <footer className={styles.footer}>
        <Link href="/">Главная</Link>
        <Link href="/privacy">Конфиденциальность</Link>
        <Link href="/security">Безопасность</Link>
      </footer>
    </div>
  );
}
