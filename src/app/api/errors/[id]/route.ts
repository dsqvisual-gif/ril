import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasErrorsToken } from "@/lib/errors-token";

const STATUSES = new Set(["open", "fixed", "ignored"]);

/** Marks an error fixed or ignored, with a note on what was done. Needs ERRORS_TOKEN. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!hasErrorsToken(req)) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  const data = (await req.json().catch(() => null)) as { status?: string; note?: string } | null;
  if (!data?.status || !STATUSES.has(data.status)) return new Response(null, { status: 400 });
  const { count } = await prisma.errorEvent.updateMany({
    where: { id },
    data: {
      status: data.status,
      fixedAt: data.status === "fixed" ? new Date() : null,
      fixNote: typeof data.note === "string" ? data.note.slice(0, 1000) : undefined,
    },
  });
  return count ? Response.json({ ok: true }) : new Response(null, { status: 404 });
}
