"use client";

import { useEffect } from "react";

/** Reloads the page, and does it by itself once the connection comes back. */
export function RetryButton() {
  useEffect(() => {
    const back = () => window.location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);

  return (
    <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
      Попробовать снова
    </button>
  );
}
