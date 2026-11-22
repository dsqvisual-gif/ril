"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";

/** Last-resort page when even the root layout fails; it has no app styles. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const digest = (error as { digest?: string } | null)?.digest;
    if (!digest) reportClientError(error, "global error boundary");
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6f8ff",
          color: "#141b3a",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <title>Ошибка — Uspeyka</title>
        <div>
          <h1 style={{ fontSize: "1.6rem" }}>Ой, что-то сломалось</h1>
          <p style={{ color: "#5a6280" }}>Мы уже получили отчёт и починим. Попробуйте ещё раз.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "0.8rem",
              padding: "0.8rem 1.4rem",
              borderRadius: 999,
              border: 0,
              background: "#1757f5",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
