import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type ErrorReport = {
  source: "server" | "client";
  message: string;
  stack?: string | null;
  path?: string | null;
  context?: string | null;
  digest?: string | null;
};

const LIMITS = { message: 1000, stack: 6000, path: 300, context: 500, digest: 100 };

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const text = String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Emails, long numbers and tokens are cut out, so logs hold no personal data.
function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>")
    .replace(/\b[a-z0-9]{24,}\b/gi, "<id>")
    .replace(/\b\d{6,}\b/g, "<number>");
}

/** The first stack line that points at our own code, used to tell errors apart. */
function topFrame(stack: string | null): string {
  if (!stack) return "";
  const lines = stack.split("\n").map((l) => l.trim());
  const own = lines.find((l) => l.startsWith("at ") && !l.includes("node_modules") && !l.includes("node:"));
  // Chunk hashes change with each deploy; keep the function name and file only.
  return (own ?? lines[1] ?? "").replace(/[?#].*$/, "").replace(/:\d+:\d+\)?$/, "").replace(/-[0-9a-f]{8,}\./, ".");
}

/** Errors that come from outside the app and cannot be fixed in it. */
export function isNoise(report: ErrorReport): boolean {
  const m = report.message;
  return (
    /ResizeObserver loop|Script error\.?$|Load failed|NetworkError|Failed to fetch|cancelled|AbortError|ChunkLoadError|Loading chunk .* failed/i.test(m) ||
    /chrome-extension:|moz-extension:|safari-extension:/i.test(report.stack ?? "") ||
    // Next.js control flow, not errors.
    /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/.test(m)
  );
}

/** Saves an error, merging it with earlier ones of the same kind. Never throws. */
export async function logError(raw: ErrorReport): Promise<void> {
  try {
    const report: ErrorReport = {
      source: raw.source,
      message: scrub(clip(raw.message, LIMITS.message) ?? "Unknown error"),
      stack: raw.stack ? scrub(clip(raw.stack, LIMITS.stack)!) : null,
      path: clip(raw.path?.split("?")[0], LIMITS.path),
      context: clip(raw.context, LIMITS.context),
      digest: clip(raw.digest, LIMITS.digest),
    };
    if (isNoise(report)) return;

    const fingerprint = createHash("sha256")
      .update(`${report.source}|${report.message.replace(/\d+/g, "#")}|${topFrame(report.stack ?? null)}`)
      .digest("hex")
      .slice(0, 40);

    const now = new Date();
    await prisma.errorEvent.upsert({
      where: { fingerprint },
      create: { fingerprint, ...report },
      update: {
        count: { increment: 1 },
        lastSeen: now,
        path: report.path,
        stack: report.stack ?? undefined,
        digest: report.digest ?? undefined,
      },
    });
    // A fixed error that happens again after the fix is open again; ignored ones stay ignored.
    // The grace period covers requests that were already running when the fix went out.
    await prisma.errorEvent.updateMany({
      where: { fingerprint, status: "fixed", fixedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
      data: { status: "open" },
    });
  } catch (error) {
    console.error("logError failed", error);
  }
}
