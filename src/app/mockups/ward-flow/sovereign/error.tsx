"use client";

import { useEffect } from "react";
import styles from "@/components/ward-management/sovereign/sovereign-showcase.module.css";

export default function SovereignShowcaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sovereign Showcase error:", error);
  }, [error]);

  return (
    <main className={styles.workspace} role="alert" aria-label="Sovereign Showcase Error">
      <section className={styles.heroBanner}>
        <div className={styles.heroText}>
          <h2>Something went wrong</h2>
          <p>Failed to load the Sovereign Suite showcase screen.</p>
        </div>
        <div className={styles.heroActions}>
          <button type="button" className={styles.btnPrimary} onClick={() => reset()}>
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
