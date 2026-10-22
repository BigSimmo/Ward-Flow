"use client";

import { ChevronUp, FlaskConical } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { WardDemoPanel } from "../tools/ward-demo-panel";
import toolStyles from "../tools/ward-tools-sheet.module.css";
import styles from "./ward-demo-menu.module.css";

/**
 * The Demo menu (change 8, D-77, 21 Oct 2026): the demo scenario, clock, file and reset controls
 * left Tools, so Tools keeps working tools only. They open from the header's Synthetic pill, which
 * already says the data is invented. It places itself under the pill; the pill owns opening and
 * returning focus. Focus moves in on open, as the Board time pill sits after the menu in
 * the page and Tab would otherwise skip it. Escape and a press outside close it here, so the pill's
 * first-load code stays small (the ED phone budget).
 */
export function WardDemoMenu({ onClose }: { onClose: (refocus?: boolean) => void }) {
  const root = useRef<HTMLElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number }>();
  useLayoutEffect(() => {
    // The pill is the first child of the wrapper the menu renders in.
    const rect = root.current?.parentElement?.firstElementChild?.getBoundingClientRect();
    if (rect) setPlace({ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, window.innerWidth - 468)) });
  }, []);
  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      // The pill and the menu share its wrapper. The menu's confirm dialog sits in a portal; a press
      // there is not outside either.
      const target = event.target as Element;
      if (!target.closest?.('[data-data-mode="prototype"], [aria-modal="true"]')) onClose(false);
    };
    const onKey = (event: KeyboardEvent) => {
      // A confirm open over the menu takes Escape first.
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
    <section
      ref={root}
      className={styles.menu}
      style={place}
      role="dialog"
      aria-label="Demo"
      data-testid="ward-demo-menu"
    >
      <div className={toolStyles.card}>
        <button ref={first} type="button" className={toolStyles.row} aria-expanded="true" onClick={() => onClose()}>
          <span className={`${toolStyles.rowIcon} ${styles.icon}`} aria-hidden="true">
            <FlaskConical aria-hidden="true" strokeWidth={1.75} />
          </span>
          <span className={toolStyles.rowText}>
            <strong>Demo</strong>
            <em>Scenario, clock and reset. Synthetic data only.</em>
          </span>
          <ChevronUp className={toolStyles.rowCaret} aria-hidden="true" strokeWidth={1.75} />
        </button>
        <div className={toolStyles.toolPanel}>
          <WardDemoPanel oneList />
        </div>
      </div>
    </section>
  );
}
