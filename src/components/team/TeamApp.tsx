"use client";

import { useState, type FormEvent } from "react";
import {
  createCompany,
  getCompanyView,
  respondToInvitation,
  type CompanyInvitation,
  type CompanySummary,
  type CompanyView,
} from "@/lib/actions/company";
import { errorText, unwrap, type ActionResult } from "@/lib/action-result";
import { AchievementToast } from "../AchievementToast";
import { MascotIdle } from "../MascotIdle";
import { TeamTasks } from "./TeamTasks";
import { TeamTimeline } from "./TeamTimeline";
import { TeamPeople } from "./TeamPeople";
import styles from "./Team.module.css";

type Tab = "tasks" | "timeline" | "people";

const TABS: { id: Tab; label: string }[] = [
  { id: "tasks", label: "Задачи" },
  { id: "timeline", label: "График" },
  { id: "people", label: "Люди" },
];

type Props = {
  initialCompanies: CompanySummary[];
  initialInvitations: CompanyInvitation[];
  initialView: CompanyView | null;
};

export type RunView = (
  key: string,
  action: () => Promise<ActionResult<CompanyView>>,
  fallback: string,
) => Promise<boolean>;

export function TeamApp({ initialCompanies, initialInvitations, initialView }: Props) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [view, setView] = useState<CompanyView | null>(initialView);
  const [tab, setTab] = useState<Tab>("tasks");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(initialCompanies.length === 0);

  function syncSummary(next: CompanyView) {
    setCompanies((prev) => {
      const summary: CompanySummary = {
        id: next.company.id,
        name: next.company.name,
        plan: next.company.plan,
        role: next.me.role,
        memberCount: next.members.filter((m) => m.status === "active").length,
      };
      return prev.some((c) => c.id === summary.id)
        ? prev.map((c) => (c.id === summary.id ? summary : c))
        : [...prev, summary];
    });
  }

  const run: RunView = async (key, action, fallback) => {
    setBusy(key);
    try {
      const next = unwrap(await action());
      setView(next);
      syncSummary(next);
      return true;
    } catch (err) {
      setToast(errorText(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  async function open(companyId: string) {
    if (view?.company.id === companyId) return;
    setCreating(false);
    const ok = await run(companyId, () => getCompanyView(companyId), "Не удалось открыть компанию");
    if (ok) {
      setTab("tasks");
      window.history.replaceState(null, "", `/app/team?c=${companyId}`);
    }
  }

  async function handleCreate(name: string) {
    const ok = await run("create", () => createCompany(name), "Не удалось создать компанию");
    if (ok) {
      setCreating(false);
      setTab("people");
    }
    return ok;
  }

  async function answer(invite: CompanyInvitation, accept: boolean) {
    setBusy(invite.memberId);
    try {
      unwrap(await respondToInvitation(invite.memberId, accept));
      setInvitations((prev) => prev.filter((i) => i.memberId !== invite.memberId));
      if (accept) {
        setBusy(null);
        await open(invite.companyId);
      }
    } catch (err) {
      setToast(errorText(err, "Не удалось ответить на приглашение"));
    } finally {
      setBusy(null);
    }
  }

  function handleLeft(companyId: string) {
    setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    setView(null);
    window.history.replaceState(null, "", "/app/team");
  }

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Команда</h1>
          <p className={styles.lead}>
            Компания, люди по никам, задачи с исполнителем и дедлайном — и график, кто чем занят.
          </p>
        </div>
        <span className={styles.planBadge} title="Позже это будет платный тариф">
          Бизнес · бесплатно на время теста
        </span>
      </header>

      {invitations.length > 0 ? (
        <div className={styles.invites}>
          {invitations.map((invite) => (
            <article key={invite.memberId} className={styles.invite}>
              <p>
                <b>{invite.invitedBy ?? "Вас"}</b> {invite.invitedBy ? "приглашает вас" : "пригласили"} в
                компанию <b>«{invite.companyName}»</b>
              </p>
              <div className={styles.inviteActions}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === invite.memberId}
                  onClick={() => void answer(invite, true)}
                >
                  Вступить
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy === invite.memberId}
                  onClick={() => void answer(invite, false)}
                >
                  Отклонить
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {companies.length > 0 ? (
        <nav className={styles.switcher} aria-label="Компании">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.companyPill} ${view?.company.id === c.id && !creating ? styles.companyPillActive : ""}`}
              onClick={() => void open(c.id)}
              disabled={busy === c.id}
            >
              {c.name}
              <span>{c.memberCount}</span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.companyPill} ${styles.companyNew} ${creating ? styles.companyPillActive : ""}`}
            onClick={() => setCreating(true)}
          >
            + Новая компания
          </button>
        </nav>
      ) : null}

      {creating || companies.length === 0 ? (
        <CreateCompany
          first={companies.length === 0}
          busy={busy === "create"}
          onCreate={handleCreate}
          onCancel={companies.length > 0 ? () => setCreating(false) : undefined}
        />
      ) : view ? (
        <>
          <div className={styles.tabs} role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? styles.tabActive : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "tasks" ? <TeamTasks view={view} busy={busy} run={run} /> : null}
          {tab === "timeline" ? <TeamTimeline view={view} /> : null}
          {tab === "people" ? (
            <TeamPeople view={view} busy={busy} run={run} onLeft={handleLeft} onError={setToast} />
          ) : null}
        </>
      ) : (
        <p className={styles.muted}>Выберите компанию выше.</p>
      )}

      {toast ? <AchievementToast kind="error" title={toast} onClose={() => setToast(null)} /> : null}
    </section>
  );
}

function CreateCompany({
  first,
  busy,
  onCreate,
  onCancel,
}: {
  first: boolean;
  busy: boolean;
  onCreate: (name: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (await onCreate(name)) setName("");
  }

  return (
    <div className={styles.create}>
      {first ? <MascotIdle className={styles.createMascot} /> : null}
      <div className={styles.createBody}>
        <h2 className={styles.createTitle}>
          {first ? "Создайте компанию или команду" : "Новая компания"}
        </h2>
        <p className={styles.muted}>
          Потом добавите людей по никам и начнёте раздавать задачи. Если вас уже пригласили —
          приглашение появится выше.
        </p>
        <form className={styles.row} onSubmit={submit}>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название — например, «Студия Север»"
            maxLength={80}
            aria-label="Название компании"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            Создать
          </button>
          {onCancel ? (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Отмена
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
