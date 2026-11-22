import type { Metadata } from "next";
import { BabyStats } from "@/components/baby/BabyStats";
import { listChildren } from "@/lib/actions/baby";

export const metadata: Metadata = {
  title: "Статистика малыша — Uspeyka",
};

export default async function BabyStatsPage() {
  return <BabyStats kids={await listChildren()} />;
}
