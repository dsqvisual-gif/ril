import type { Metadata } from "next";
import { BabyHome } from "@/components/baby/BabyHome";
import { listChildren } from "@/lib/actions/baby";

export const metadata: Metadata = {
  title: "Малыш — Uspeyka",
};

export default async function BabyPage() {
  return <BabyHome initialChildren={await listChildren()} />;
}
