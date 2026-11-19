import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryTasks } from "@/lib/actions/tasks";
import { isDateKey } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!isDateKey(from) || !isDateKey(to) || from > to) {
    return NextResponse.json({ error: "Bad range" }, { status: 400 });
  }

  const tasks = await queryTasks(from, to);
  return NextResponse.json(tasks);
}
