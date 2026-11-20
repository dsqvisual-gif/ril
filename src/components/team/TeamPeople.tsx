"use client";

import { useState, type FormEvent } from "react";
import {
  deleteCompany,
  inviteToCompany,
  removeCompanyMember,
  renameCompany,
  setCompanyMemberRole,
  type CompanyMemberDTO,
  type CompanyView,
} from "@/lib/actions/company";
import { errorText, unwrap } from "@/lib/action-result";
import type { RunView } from "./TeamApp";
import { initials } from "./team-utils";
import styles from "./Team.module.css";

const ROLE_LABEL: Record<CompanyMemberDTO["role"], string> = {
  owner: "Владелец",
  admin: "Администратор",
  member: "Участник",
};

type Props = {
  view: CompanyView;
  busy: string | null;
  run: RunView;
  onLeft: (companyId: string) => void;
  onError: (message: string) => void;
};

export function TeamPeople({ view, busy, run, onLeft, onError }: Props) {
  const [nick, setNick] = useState("");
  const [name, setName] = useState(view.company.name);
  const isOwner = view.me.role === "owner";
  const manager = isOwner || view.me.role === "admin";
  const companyId = view.company.id;

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!nick.trim()) return;
    if (await run("invite", () => inviteToCompany(companyId, nick), "Не удалось пригласить")) {
      setNick("");
    }
  }

  async function remove(member: CompanyMemberDTO) {
    const self = member.userId === view.me.userId;
    const question = self
      ? `Выйти из компании «${view.company.name}»?`
      : member.status === "invited"
        ? `Отменить приглашение для ${member.name}?`
        : `Убрать ${member.name} из компании? Задачи этого человека останутся без исполнителя.`;
    if (!window.confirm(question)) return;
    if (self) {
      try {
        unwrap(await removeCompanyMember(companyId, member.id));
        onLeft(companyId);
      } catch (err) {
        onError(errorText(err, "Не удалось выйти из компании"));
      }
      return;
    }
    await run(
      member.id,
      async () => {
        const result = await removeCompanyMember(companyId, member.id);
        return result.ok && result.data
          ? { ok: true as const, data: result.data }
          : result.ok
            ? { ok: false as const, error: "Не удалось обновить список" }
            : result;
      },
      "Не удалось убрать участника",
    );
  }

  async function destroy() {
    if (
      !window.confirm(
        `Удалить компанию «${view.company.name}» вместе со всеми задачами? Это нельзя отменить.`,
      )
    )
      return;
    try {
      unwrap(await deleteCompany(companyId));
      onLeft(companyId);
    } catch (err) {
      onError(errorText(err, "Не удалось удалить компанию"));
    }
  }

  return (
    <div className={styles.panel}>
      {manager ? (
        <form className={styles.inviteForm} onSubmit={invite}>
          <label className={styles.label}>
            Добавить человека по нику
            <div className={styles.row}>
              <span className={styles.at}>@</span>
              <input
                className={styles.input}
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="ник"
                maxLength={21}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" className="btn btn-primary" disabled={busy === "invite" || !nick.trim()}>
                Пригласить
              </button>
            </div>
          </label>
          <p className={styles.muted}>
            Приглашение придёт во вкладку «Команда». Как только человек его примет, он появится в
            списке и на него можно будет назначать задачи.
          </p>
        </form>
      ) : null}

      <ul className={styles.people}>
        {view.members.map((m) => {
          const self = m.userId === view.me.userId;
          const canRemove =
            m.role !== "owner" &&
            (self || (manager && (m.role !== "admin" || isOwner)));
          return (
            <li key={m.id} className={m.status === "invited" ? styles.personInvited : undefined}>
              <span className={styles.avatar}>{initials(m.name)}</span>
              <div className={styles.personBody}>
                <p className={styles.personName}>
                  {m.name}
                  {self ? <span className={styles.muted}> (я)</span> : null}
                </p>
                <p className={styles.muted}>
                  {m.username ? `@${m.username}` : ""}
                  {m.status === "invited" ? " · ждёт подтверждения" : ""}
                </p>
              </div>
              {isOwner && m.role !== "owner" && m.status === "active" ? (
                <select
                  className={styles.select}
                  value={m.role}
                  disabled={busy === m.id}
                  aria-label={`Роль ${m.name}`}
                  onChange={(e) =>
                    void run(
                      m.id,
                      () =>
                        setCompanyMemberRole(companyId, m.id, e.target.value as "admin" | "member"),
                      "Не удалось сменить роль",
                    )
                  }
                >
                  <option value="member">Участник</option>
                  <option value="admin">Администратор</option>
                </select>
              ) : (
                <span className={styles.roleTag}>{ROLE_LABEL[m.role]}</span>
              )}
              {canRemove ? (
                <button
                  type="button"
                  className={styles.dangerLink}
                  disabled={busy === m.id}
                  onClick={() => void remove(m)}
                >
                  {self ? "Выйти" : m.status === "invited" ? "Отменить" : "Убрать"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className={styles.muted}>
        Владелец меняет роли и может удалить компанию. Администраторы приглашают людей и управляют
        всеми задачами. Участники создают задачи и двигают свои по статусам.
      </p>

      {manager ? (
        <div className={styles.settings}>
          <h3 className={styles.blockTitle}>Настройки компании</h3>
          <form
            className={styles.row}
            onSubmit={(e) => {
              e.preventDefault();
              void run("rename", () => renameCompany(companyId, name), "Не удалось переименовать");
            }}
          >
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              aria-label="Название компании"
            />
            <button
              type="submit"
              className="btn btn-ghost"
              disabled={busy === "rename" || !name.trim() || name.trim() === view.company.name}
            >
              Переименовать
            </button>
          </form>
          {isOwner ? (
            <button type="button" className={styles.dangerLink} onClick={() => void destroy()}>
              Удалить компанию
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
