import { unstable_rethrow } from "next/navigation";

// In production Next.js replaces the message of any error thrown from a server
// action, so user-facing errors travel back as a value instead.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** An error whose message is safe to show to the user. */
export class UserError extends Error {}

const FALLBACK = "Что-то пошло не так. Попробуйте ещё раз.";

export async function toResult<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof UserError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: FALLBACK };
  }
}

/** Message for the user: the server's own text, or `fallback` for anything else. */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof UserError ? error.message : fallback;
}

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new UserError(result.error);
  return result.data;
}
