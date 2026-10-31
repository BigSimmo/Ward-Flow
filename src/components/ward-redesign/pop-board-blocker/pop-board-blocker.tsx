"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The Record a blocker mock-up, drawn over the bed board. The board's fork uses this folder's copy of
 * the work band, so the dialog is the page's own: this opens it on load by pressing the first Needs
 * you tile's "Record a blocker", as a charge nurse would. `page` is the page it opens over.
 */
export function PopBoardBlocker({ page }: { page: ReactNode }) {
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const action = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-testid="ward-board-work-band-list"] button'),
      ).find((button) => button.textContent?.trim() === "Record a blocker");
      if (!action && tries < 100) return;
      window.clearInterval(timer);
      action?.click();
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  return <>{page}</>;
}
