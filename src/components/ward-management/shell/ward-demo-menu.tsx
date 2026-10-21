"use client";

import { ChevronUp, FlaskConical } from "lucide-react";
import { useEffect, useRef } from "react";

import { WardDemoPanel } from "../tools/ward-demo-panel";
import toolStyles from "../tools/ward-tools-sheet.module.css";
import styles from "./ward-demo-menu.module.css";

/**
 * The Demo menu (change 8, D-77, 21 Oct 2026): the demo scenario, clock, file and reset controls
 * left Tools, so Tools keeps working tools only. They open from the header's Synthetic pill, which
 * already says the data is invented. `top` and `left` place it under the pill; the pill owns
 * opening, closing and returning focus. Focus moves in on open, as the Board time pill sits after
 * the menu in the page and Tab would otherwise skip it.
 */
export function WardDemoMenu({ top, left, onClose }: { top: number; left: number; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <section className={styles.menu} style={{ top, left }} role="dialog" aria-label="Demo" data-testid="ward-demo-menu">
      <div className={toolStyles.card}>
        <button ref={first} type="button" className={toolStyles.row} aria-expanded="true" onClick={onClose}>
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
