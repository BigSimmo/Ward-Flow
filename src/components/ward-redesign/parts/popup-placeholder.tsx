"use client";

import type { ReactNode } from "react";

/**
 * Preview only: a popup or state that is registered but not rebuilt yet. Its page draws as usual,
 * with a small note in the corner naming what will open over it.
 */
export function PopupPlaceholder({ page, label }: { page: ReactNode; label: string }) {
  return (
    <>
      {page}
      <p
        role="status"
        style={{
          position: "fixed",
          right: "var(--wf-s-4)",
          bottom: "var(--wf-s-4)",
          zIndex: 1000,
          margin: 0,
          padding: "var(--wf-s-2) var(--wf-s-3)",
          border: "1px solid var(--wf-line)",
          borderRadius: "var(--wf-r-lg)",
          background: "var(--wf-surface)",
          color: "var(--wf-ink-2)",
          fontSize: "var(--wf-fs-13)",
        }}
      >
        {`${label}: not rebuilt yet.`}
      </p>
    </>
  );
}
