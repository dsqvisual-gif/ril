import type { Metadata } from "next";
import { GoalsBoard } from "@/components/GoalsBoard";
import { listGoals } from "@/lib/actions/goals";

export const metadata: Metadata = {
  title: "Цели — Uspeyka",
};

export default async function GoalsPage() {
  const goals = await listGoals();
  return <GoalsBoard initialGoals={goals} />;
}
