import { timingSafeEqual } from "node:crypto";

/** Checks the Bearer token that the error export API and the auto-fix task use. */
export function hasErrorsToken(request: Request): boolean {
  const expected = process.env.ERRORS_TOKEN?.trim();
  if (!expected || expected.length < 24) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
