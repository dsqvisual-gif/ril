import type { Instrumentation } from "next";

/** Records every server error users hit, so it can be found and fixed later. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("@/lib/error-log");
  const error = err instanceof Error ? err : new Error(String(err));
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;
  await logError({
    source: "server",
    message: error.message,
    stack: error.stack ?? null,
    path: context.routePath || request.path,
    context: `${request.method} ${context.routeType}${context.renderSource ? ` · ${context.renderSource}` : ""}`,
    digest,
  });
};
