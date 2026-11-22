import { isRedirectError } from "next/dist/client/components/redirect-error";
import * as tasks from "@/lib/actions/tasks";
import * as friends from "@/lib/actions/friends";
import * as goals from "@/lib/actions/goals";
import * as company from "@/lib/actions/company";
import * as account from "@/lib/actions/account";
import { claimAchievements } from "@/lib/actions/achievements";
import { syncAchievements } from "@/lib/achievement-stats";
import { mobileJson, mobileUserId, preflight } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

/** Achievements page data: the person's numbers and what is unlocked. */
async function achievementsOverview() {
  const userId = await requireUserId();
  const { stats } = await syncAchievements(userId);
  const unlocks = await prisma.achievementUnlock.findMany({
    where: { userId },
    select: { code: true, unlockedAt: true },
  });
  return { stats, unlocked: unlocks.map((u) => ({ code: u.code, at: u.unlockedAt.toISOString() })) };
}

/**
 * The website's own actions the app may call — the same code, checks and data as
 * on the site. Each one finds the user through requireUserId(), which accepts the
 * app's token. Only names listed here can be called.
 */
const ACTIONS: Record<string, (...args: never[]) => Promise<unknown>> = {
  "tasks.query": tasks.queryTasks,
  "tasks.settle": tasks.settleOpenTasks,
  "tasks.create": tasks.createTask,
  "tasks.update": tasks.updateTask,
  "tasks.toggle": tasks.toggleTask,
  "tasks.delete": tasks.deleteTask,
  "tasks.keep": tasks.keepTask,
  "tasks.move": tasks.moveTask,
  "tasks.search": tasks.searchTasks,
  "tasks.itemToggle": tasks.toggleTaskItem,
  "tasks.itemAdd": tasks.addTaskItem,
  "tasks.itemRemove": tasks.removeTaskItem,
  "friends.board": friends.getFriendsBoard,
  "friends.search": friends.searchAccounts,
  "friends.list": friends.listAcceptedFriends,
  "friends.request": friends.requestFriend,
  "friends.accept": friends.acceptFriend,
  "friends.remove": friends.removeFriendship,
  "friends.rename": friends.renameFriend,
  "goals.list": goals.listGoals,
  "goals.create": goals.createGoal,
  "goals.setDone": goals.setGoalDone,
  "goals.delete": goals.deleteGoal,
  "goals.addEntry": goals.addGoalEntry,
  "goals.deleteEntry": goals.deleteGoalEntry,
  "goals.setMeasure": goals.setGoalMeasure,
  "goals.setSelfProgress": goals.setGoalSelfProgress,
  "company.list": company.listMyCompanies,
  "company.view": company.getCompanyView,
  "company.create": company.createCompany,
  "company.invite": company.inviteToCompany,
  "company.respond": company.respondToInvitation,
  "company.createTask": company.createCompanyTask,
  "company.updateTask": company.updateCompanyTask,
  "company.deleteTask": company.deleteCompanyTask,
  "achievements.overview": achievementsOverview,
  "achievements.claim": claimAchievements,
  "account.rename": account.renameMe,
};

export async function POST(request: Request) {
  const userId = await mobileUserId(request);
  if (!userId) return mobileJson(request, { error: "unauthorized" }, 401);

  const body = (await request.json().catch(() => null)) as { fn?: unknown; args?: unknown } | null;
  const fn = typeof body?.fn === "string" ? ACTIONS[body.fn] : undefined;
  if (!fn) return mobileJson(request, { error: "Неизвестное действие" }, 404);
  const args = Array.isArray(body?.args) ? (body.args as never[]) : [];

  try {
    const result = await fn(...args);
    return mobileJson(request, { result: result ?? null });
  } catch (error) {
    if (isRedirectError(error)) return mobileJson(request, { error: "unauthorized" }, 401);
    console.error("mobile rpc failed", body?.fn, error);
    return mobileJson(request, { error: "Что-то пошло не так. Попробуйте ещё раз." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return preflight(request);
}

