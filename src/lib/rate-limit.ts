import { prisma } from "@/lib/prisma";

/**
 * Fixed-window counter in Postgres, so limits hold across serverless instances.
 * Returns true while `key` is within `limit` hits per `windowSeconds`.
 * Fails open: if the table is missing or the DB errors, the request is allowed.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, NOW() + ${windowSeconds}::int * INTERVAL '1 second')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count"`;
    if (Math.random() < 0.01) {
      await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < NOW()`;
    }
    return (rows[0]?.count ?? 0) <= limit;
  } catch (error) {
    console.error("rateLimit failed, allowing request", error);
    return true;
  }
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
