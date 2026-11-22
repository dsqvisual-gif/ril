import type { Metadata } from "next";
import Link from "next/link";
import { SettingsGroup, SettingsPage } from "@/components/settings/SettingsNav";
import { replayOnboarding } from "@/lib/actions/onboarding";
import { CONTACT_EMAIL } from "@/lib/site";
import styles from "@/components/settings/Settings.module.css";

export const metadata: Metadata = { title: "Помощь и документы — Uspeyka" };

export default function AboutSettings() {
  return (
    <SettingsPage title="Помощь и документы">
      <div className={styles.card}>
        <p className={styles.hint}>Забыли, где что? Маскот ещё раз покажет главное.</p>
        <form action={replayOnboarding}>
          <button type="submit" className="btn btn-ghost">
            Показать знакомство с приложением
          </button>
        </form>
        <p className={styles.hint}>
          Вопросы и предложения: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
      <SettingsGroup title="Документы">
        <DocLink href="/privacy" title="Политика конфиденциальности" />
        <DocLink href="/terms" title="Правила использования" />
        <DocLink href="/security" title="Безопасность" />
      </SettingsGroup>
    </SettingsPage>
  );
}

function DocLink({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href} className={styles.docLink}>
      {title}
      <span aria-hidden>›</span>
    </Link>
  );
}
