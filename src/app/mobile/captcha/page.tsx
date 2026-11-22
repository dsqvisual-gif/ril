import type { Metadata } from "next";
import { CaptchaBridge } from "@/components/mobile/CaptchaBridge";

export const metadata: Metadata = { title: "Проверка — Uspeyka", robots: { index: false } };

/** Shown inside the app: the Cloudflare check, whose token goes back to the app. */
export default function CaptchaPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "transparent",
        fontFamily: "system-ui, sans-serif",
        padding: 12,
      }}
    >
      <CaptchaBridge />
    </main>
  );
}
