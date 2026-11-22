/** Sends a browser error to /api/errors. Each distinct error is sent once per page load. */
const sent = new Set<string>();
const MAX_PER_PAGE = 10;

export function reportClientError(error: unknown, context?: string): void {
  if (typeof window === "undefined" || sent.size >= MAX_PER_PAGE) return;
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  const key = `${err.message}|${context ?? ""}`;
  if (sent.has(key)) return;
  sent.add(key);
  const body = JSON.stringify({
    message: err.message,
    stack: err.stack ?? null,
    path: window.location.pathname,
    context: [context, navigator.userAgent].filter(Boolean).join(" · ").slice(0, 480),
    digest: (err as Error & { digest?: string }).digest ?? null,
  });
  try {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never break the page.
  }
}
