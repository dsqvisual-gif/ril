import type { Metadata } from "next";
import { BabyReport } from "@/components/baby/BabyReport";
import { listChildren } from "@/lib/actions/baby";

export const metadata: Metadata = {
  title: "Отчёт для педиатра — Uspeyka",
};

export default async function ReportPage() {
  return <BabyReport kids={await listChildren()} />;
}
