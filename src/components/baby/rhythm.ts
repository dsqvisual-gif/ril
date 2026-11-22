import { format } from "date-fns";
import type { BabyEventDTO } from "@/lib/actions/baby";
import { formatDuration } from "@/lib/baby";

export type RhythmTip = { icon: string; text: string; now: boolean };

const H = 3_600_000;
const SOON = 10 * 60_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * When the baby is usually ready to sleep and to eat, from the last three days:
 * the typical awake time between sleeps and the typical gap between feeds.
 * Needs at least three examples of each, and says nothing otherwise.
 */
export function rhythm(events: BabyEventDTO[], now: number): RhythmTip[] {
  const since = now - 3 * 24 * H;
  const asc = [...events].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const tips: RhythmTip[] = [];

  const sleeps = asc.filter((e) => e.kind === "sleep" && e.endedAt && new Date(e.startedAt).getTime() >= since);
  const wakes: number[] = [];
  for (let i = 1; i < sleeps.length; i++) {
    const gap = new Date(sleeps[i].startedAt).getTime() - new Date(sleeps[i - 1].endedAt!).getTime();
    if (gap > 15 * 60_000 && gap < 6 * H) wakes.push(gap);
  }
  const running = asc.find((e) => e.kind === "sleep" && !e.endedAt);
  const lastSleep = [...sleeps].reverse()[0];
  if (wakes.length >= 3 && !running && lastSleep) {
    const wake = median(wakes);
    const at = new Date(lastSleep.endedAt!).getTime() + wake;
    if (at > now - 2 * H) {
      tips.push({
        icon: "😴",
        now: at - now < SOON,
        text:
          at - now < SOON
            ? `Пора укладывать: обычно бодрствует ~${formatDuration(wake)}`
            : `Обычно бодрствует ~${formatDuration(wake)} — укладывать около ${format(at, "HH:mm")}`,
      });
    }
  }

  const feeds = asc.filter((e) => e.kind === "feed" && new Date(e.startedAt).getTime() >= since);
  const gaps: number[] = [];
  for (let i = 1; i < feeds.length; i++) {
    const gap = new Date(feeds[i].startedAt).getTime() - new Date(feeds[i - 1].startedAt).getTime();
    if (gap > 30 * 60_000 && gap < 6 * H) gaps.push(gap);
  }
  const feeding = feeds.some((e) => !e.endedAt);
  const lastFeed = feeds[feeds.length - 1];
  if (gaps.length >= 3 && !feeding && lastFeed) {
    const gap = median(gaps);
    const at = new Date(lastFeed.startedAt).getTime() + gap;
    if (at > now - 2 * H) {
      tips.push({
        icon: "🍼",
        now: at - now < SOON,
        text:
          at - now < SOON
            ? `Скоро кормить: обычно каждые ~${formatDuration(gap)}`
            : `Кормит обычно каждые ~${formatDuration(gap)} — следующее около ${format(at, "HH:mm")}`,
      });
    }
  }
  return tips;
}
