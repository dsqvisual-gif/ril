import { PlannerApp } from "@/components/PlannerApp";
import { listAcceptedFriends } from "@/lib/actions/friends";
import { queryTasks } from "@/lib/actions/tasks";
import { todayKey } from "@/lib/dates";

export default async function PlannerPage() {
  const date = todayKey();
  const [tasks, friends] = await Promise.all([
    queryTasks(date, date),
    listAcceptedFriends(),
  ]);

  return <PlannerApp initialDate={date} initialTasks={tasks} friends={friends} />;
}
