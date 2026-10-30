"use client";

import { FlaskConical, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { Button, OverlayPortal } from "@/components/wf";

import { DemoPanelMock } from "./demo-panel";
import styles from "./pop-demo.module.css";

/**
 * Mock-up fork of `shell/ward-demo-menu.tsx` (the Demo menu, change 8, D-77). Design changes only:
 * a plain header with a close button instead of the collapsing row, the panel laid out as two grids
 * (Scenario, See it as) with the clock on one row and the file and reset buttons in a footer. The real
 * menu renders inside the pill's wrapper; this copy is portalled and places itself under the same
 * pill, found by its `data-data-mode` attribute. Escape and a press outside still close it.
 */
export function DemoMenuMock({ onClose }: { onClose: (refocus?: boolean) => void }) {
  const root = useRef<HTMLElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    // Placed straight on the element (no state), under the header's Synthetic pill. The pill can
    // arrive a few frames after the page, so it is looked for again for up to a second.
    let frame = 0;
    let tries = 0;
    const place = () => {
      const menu = root.current;
      if (!menu) return;
      const pill = document.querySelector('[data-data-mode="prototype"]');
      const rect = pill && pill.getClientRects().length > 0 ? pill.getBoundingClientRect() : null;
      const width = Math.min(560, window.innerWidth - 16);
      const left = rect ? Math.min(rect.left, window.innerWidth - width - 8) : window.innerWidth - width - 8;
      menu.style.top = `${rect ? rect.bottom + 8 : 64}px`;
      menu.style.left = `${Math.max(8, left)}px`;
      menu.style.visibility = "visible";
      if (!rect && tries++ < 60) frame = window.requestAnimationFrame(place);
    };
    place();
    return () => window.cancelAnimationFrame(frame);
  });
  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      // A press on the pill closes this copy too, so the pill's own menu never opens beside it.
      if (!root.current?.contains(target) && !target.closest?.('[aria-modal="true"]')) onClose(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[aria-modal="true"]')) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <OverlayPortal layer="popover" name="demo-menu">
      <section
        ref={root}
        className={styles.menu}
        style={{ visibility: "hidden" }}
        role="dialog"
        aria-label="Demo"
        data-testid="ward-demo-menu"
      >
        <header className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            <FlaskConical aria-hidden="true" strokeWidth={1.75} />
          </span>
          <span className={styles.headText}>
            <strong>Demo</strong>
            <em>Scenario, role and clock. Synthetic data only.</em>
          </span>
          <Button
            ref={first}
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            aria-label="Close Demo"
            onClick={() => onClose()}
          />
        </header>
        <DemoPanelMock />
      </section>
    </OverlayPortal>
  );
}
