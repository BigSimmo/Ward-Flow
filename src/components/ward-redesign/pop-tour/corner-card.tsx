"use client";

import { useEffect } from "react";

import { OverlayPortal } from "@/components/wf";

import styles from "./corner-card.module.css";

/**
 * The help corner card, mock-up (final round, D-91): What's new (`WardWhatsNew`) or the tour offer
 * (`WardTourAutoStart`), drawn as one card so both step aside from notices the same way. It is never a
 * dialog and blocks nothing; Escape closes it, as Got it or Not now does.
 */
export function CornerCard({
  kind,
  lines,
  onPrimary,
  onClose,
}: {
  kind: "whats-new" | "tour-offer";
  /** What's new: the unseen lines. */
  lines?: readonly string[];
  onPrimary: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const whatsNew = kind === "whats-new";
  return (
    <OverlayPortal layer="overlay" name="ward-corner-card">
      <section
        className={styles.card}
        aria-labelledby="ward-corner-card-title"
        data-wf-corner-card=""
        data-testid={whatsNew ? "ward-whats-new" : "ward-tour-offer"}
      >
        <h2 id="ward-corner-card-title" className={styles.title}>
          {whatsNew ? "What's new" : "Want a quick tour? It takes about 2 minutes."}
        </h2>
        {whatsNew && lines?.length ? (
          <ul className={styles.list}>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <div className={styles.buttons}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {whatsNew ? "Got it" : "Not now"}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              onClose();
              onPrimary();
            }}
          >
            {whatsNew ? "See all in Help" : "Start the tour"}
          </button>
        </div>
      </section>
    </OverlayPortal>
  );
}
