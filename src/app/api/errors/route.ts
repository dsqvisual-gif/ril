import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/error-log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hasErrorsToken } from "@/lib/errors-token";
import { corsHeaders, preflight } from "@/lib/mobile-auth";

const MAX_BODY = 16_000;

/** Browsers report their errors here. */
export async function POST(req: NextRequest) {
  // Only pages of this site and the browser version of the app may report; the
  // phone apps send no Origin.
  const origin = req.headers.get("origin");
  const cors = corsHeaders(req);
  if (origin && new URL(origin).host !== req.headers.get("host") && !cors["Access-Control-Allow-Origin"]) {
    return new Response(null, { status: 403 });
  }
  if (!(await rateLimit(`errors:${clientIp(req.headers)}`, 30, 60 * 60))) {
    return new Response(null, { status: 429 });
  }
  const text = await req.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  if (!str(data.message)) return new Response(null, { status: 400 });

  await logError({
    source: "client",
    message: str(data.message)!,
    stack: str(data.stack),
    path: str(data.path),
    context: str(data.context),
    digest: str(data.digest),
  });
  return new Response(null, { status: 204, headers: cors });
}

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/** Open errors, most frequent recent first, for the daily auto-fix task. Needs ERRORS_TOKEN. */
export async function GET(req: NextRequest) {
  if (!hasErrorsToken(req)) return new Response(null, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const errors = await prisma.errorEvent.findMany({
    where: status === "all" ? {} : { status },
    orderBy: [{ lastSeen: "desc" }],
    take: 50,
  });
  return Response.json(errors);
}
