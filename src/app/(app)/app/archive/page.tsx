import { ArchiveList } from "@/components/ArchiveList";
import { listArchivedTasks } from "@/lib/actions/tasks";

export default async function ArchivePage() {
  const tasks = await listArchivedTasks();
  return <ArchiveList tasks={tasks} />;
}
