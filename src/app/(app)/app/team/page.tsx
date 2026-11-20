import type { Metadata } from "next";
import { TeamApp } from "@/components/team/TeamApp";
import { getCompanyView, listMyCompanies } from "@/lib/actions/company";

export const metadata: Metadata = {
  title: "Команда — Uspeyka",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ c }, { companies, invitations }] = await Promise.all([searchParams, listMyCompanies()]);
  const selected = companies.find((company) => company.id === c) ?? companies[0];
  const view = selected ? await getCompanyView(selected.id) : null;

  return (
    <TeamApp
      initialCompanies={companies}
      initialInvitations={invitations}
      initialView={view?.ok ? view.data : null}
    />
  );
}
