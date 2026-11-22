"use client";

import { useEffect } from "react";
import { syncThemeCookie } from "@/lib/actions/theme";

/** Applies the account's theme on a device that has not seen it yet. */
export function ThemeSync({ theme }: { theme: string | null }) {
  useEffect(() => {
    if (!theme) return;
    const current = document.documentElement.dataset.theme ?? "light";
    if (current === theme) return;
    document.documentElement.dataset.theme = theme;
    void syncThemeCookie(theme);
  }, [theme]);
  return null;
}
