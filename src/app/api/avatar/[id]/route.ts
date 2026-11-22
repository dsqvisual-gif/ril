import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Serves an uploaded profile photo to signed-in people (like a nickname, it is visible to other users). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({ where: { id }, select: { avatar: true } });
  if (!user?.avatar) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(user.avatar), {
    headers: {
      "Content-Type": "image/jpeg",
      // The URL carries a version, so a new photo gets a new URL.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
