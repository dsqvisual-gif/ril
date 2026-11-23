import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { addDays } from "date-fns";
import { useAccount } from "@/account/account-context";
import type { Task } from "@/account/api";
import { useRpc } from "@/account/use-rpc";
import { useStore } from "@/db/store-types";
import { toDateKey } from "@/shared/dates";
import { NOTIFY_SUPPORTED, onNotifyChanged, permission, plan, readPrefs, schedule, type NotifyData } from "./notify";

type Company = { id: string; name: string };
type TeamView = { me: { userId: string }; tasks: { id: string; title: string; assigneeId: string | null; deadline: string | null; status: string }[] };

/**
 * Keeps the phone's planned notifications in step with the account: on start, when the
 * app comes back to the foreground and after changes. Tapping a notification opens its screen.
 */
export function NotificationSync() {
  const call = useRpc();
  const store = useStore();
  const { user } = useAccount();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    if (!NOTIFY_SUPPORTED || !user) return;
    if ((await permission()) !== "granted") return;
    const prefs = await readPrefs(store);
    const today = new Date();
    const data: NotifyData = { tasks: [], reminders: [], team: [], health: [] };
    const tasks = call<Task[]>("tasks.query", toDateKey(today), toDateKey(addDays(today, 6))).then((t) => (data.tasks = t));
    const reminders = prefs.reminders ? call<NotifyData["reminders"]>("reminders.list").then((r) => (data.reminders = r)) : null;
    const team = prefs.team
      ? call<{ companies: Company[] }>("company.list").then(async ({ companies }) => {
          for (const co of companies.slice(0, 5)) {
            const v = await call<TeamView>("company.view", co.id);
            for (const t of v.tasks) {
              if (t.status !== "done" && t.assigneeId === v.me.userId) data.team.push({ id: t.id, title: t.title, deadline: t.deadline, company: co.name });
            }
          }
        })
      : null;
    const health =
      prefs.baby && user.momMode
        ? call<{ id: string; name: string }[]>("baby.children").then(async (kids) => {
            for (const k of kids) {
              const rows = await call<NotifyData["health"]>("baby.health", k.id);
              data.health.push(...rows.map((h) => ({ ...h, child: k.name })));
            }
          })
        : null;
    try {
      await Promise.all([tasks, reminders, team, health]);
      await schedule(plan(data, prefs));
    } catch {
      // Offline: what was planned before stays planned.
    }
  }, [call, store, user]);

  const soon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void sync(), 2500);
  }, [sync]);

  useEffect(() => {
    soon();
    const off = onNotifyChanged(soon);
    const app = AppState.addEventListener("change", (s) => s === "active" && soon());
    return () => {
      off();
      app.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [soon]);

  // Tapping a notification opens the matching screen.
  useEffect(() => {
    if (!NOTIFY_SUPPORTED) return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (typeof url === "string") router.navigate(url as never);
    });
    return () => sub.remove();
  }, []);

  return null;
}
