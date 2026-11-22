import { runDailyJob } from "@/lib/daily-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called every morning by Vercel Cron (see vercel.json) with CRON_SECRET as a bearer token. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const report = await runDailyJob();
  return Response.json(report);
}
