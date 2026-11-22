import type { Metadata } from "next";
import { FoodTracker } from "@/components/baby/FoodTracker";
import { listChildren } from "@/lib/actions/baby";

export const metadata: Metadata = {
  title: "Прикорм — Uspeyka",
};

export default async function FoodPage() {
  return <FoodTracker kids={await listChildren()} />;
}
