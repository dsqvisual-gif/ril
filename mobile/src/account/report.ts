import { Platform } from "react-native";
import Constants from "expo-constants";
import { SITE } from "./api";

const sent = new Set<string>();

/**
 * Sends an app error to the website's error log (admin → «Ошибки»), where the
 * nightly auto-fix task picks it up. Each distinct error is sent once per launch.
 */
export function reportAppError(error: unknown, context: string): void {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
    const key = `${err.message}|${context}`;
    if (sent.has(key) || sent.size > 20) return;
    sent.add(key);
    const where = Platform.OS === "web" && typeof window !== "undefined" ? window.location.pathname : "";
    const agent = Platform.OS === "web" && typeof navigator !== "undefined" ? navigator.userAgent : `${Platform.OS} ${Platform.Version}`;
    void fetch(`${SITE}/api/errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: err.message,
        stack: err.stack ?? null,
        path: `app${where ? ` ${where}` : ""}`,
        context: `app ${Constants.expoConfig?.version ?? ""} · ${context} · ${agent}`.slice(0, 480),
      }),
    }).catch(() => {});
  } catch {
    // Reporting must never break the app.
  }
}

/** Catches errors no screen handled. */
export function installErrorReporting(): void {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.addEventListener("error", (e) => reportAppError(e.error ?? e.message, "window.onerror"));
    window.addEventListener("unhandledrejection", (e) => reportAppError(e.reason, "unhandledrejection"));
    return;
  }
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
  };
  const previous = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((e, fatal) => {
    reportAppError(e, fatal ? "fatal" : "global");
    previous?.(e, fatal);
  });
}
