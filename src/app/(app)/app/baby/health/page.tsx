import type { Metadata } from "next";
import { HealthBoard } from "@/components/baby/HealthBoard";
import { listChildren } from "@/lib/actions/baby";

export const metadata: Metadata = {
  title: "Прививки и визиты — Uspeyka",
};

export default async function HealthPage() {
  return <HealthBoard kids={await listChildren()} />;
}
