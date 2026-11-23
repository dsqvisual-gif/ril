import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { corsHeaders, mobileUserId, preflight } from "@/lib/mobile-auth";

/** Serves an uploaded profile photo to signed-in people (like a nickname, it is visible to other users). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  // Signed-in website visitors, or the mobile app with its token.
  const session = await auth();
  const cors = corsHeaders(_req);
  if (!session?.user?.id && !(await mobileUserId(_req))) return new Response(null, { status: 401, headers: cors });

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({ where: { id }, select: { avatar: true } });
  if (!user?.avatar) return new Response(null, { status: 404, headers: cors });

  return new Response(new Uint8Array(user.avatar), {
    headers: {
      ...cors,
      "Content-Type": "image/jpeg",
      // The URL carries a version, so a new photo gets a new URL.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
