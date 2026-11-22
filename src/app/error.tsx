"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { reportClientError } from "@/lib/report-error";
import styles from "./error.module.css";

/** Shown instead of a page that crashed. The error is reported automatically. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Server errors carry a digest and were already recorded on the server.
    const digest = (error as { digest?: string } | null)?.digest;
    if (!digest) reportClientError(error, "error boundary");
  }, [error]);

  return (
    <main className={styles.wrap}>
      <Image src="/mascot-peek.webp" alt="" width={200} height={156} className={styles.mascot} />
      <h1>Ой, что-то сломалось</h1>
      <p>
        Мы уже получили отчёт об ошибке и починим её. Попробуйте ещё раз — чаще всего это
        помогает.
      </p>
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          Попробовать снова
        </button>
        <Link href="/app" className="btn btn-ghost">
          В планер
        </Link>
      </div>
    </main>
  );
}
