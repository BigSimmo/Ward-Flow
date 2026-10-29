"use client";

import { useEffect, useRef } from "react";

import { WardScreen } from "@/components/ward-management/ward/ward-screen";

import styles from "./ward-redesign.module.css";

/** The one ward the mock-up draws, as the app's own example address does. */
const WARD_ID = "rph-adult-secure";

/**
 * Opens the Ward flow card on its busiest list once, as the redesign asks ("Admissions here"),
 * by pressing the real list switch. Preview glue only: the real change is one default in
 * `ward-screen.tsx`, where the list choice lives.
 */
function useBusiestFlowList(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const pick = () => {
      const group = root.current?.querySelector('[role="radiogroup"][aria-label="Ward flow list"]');
      if (!group) {
        if (tries++ < 120) frame = window.requestAnimationFrame(pick);
        return;
      }
      const options = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
      const count = (option: HTMLButtonElement) => Number(option.querySelector("span")?.textContent ?? 0) || 0;
      const busiest = options.reduce<HTMLButtonElement | null>(
        (best, option) => (best === null || count(option) > count(best) ? option : best),
        null,
      );
      const chosen = options.find((option) => option.getAttribute("aria-checked") === "true");
      if (busiest && chosen && count(chosen) === 0 && busiest !== chosen) busiest.click();
    };
    frame = window.requestAnimationFrame(pick);
    return () => window.cancelAnimationFrame(frame);
  }, [root]);
}

/**
 * My ward, redesigned. `ward-screen.tsx` and the bed tiles in `ward-home-tab.tsx` are over the
 * repository's 1,500-line limit, so they cannot be copied whole into the preview. This draws the
 * real screen, with every bed, filter, Place or move, This shift and Confirm numbers working as
 * now, and applies the redesign with one scoped stylesheet. The build notes list the changes that
 * are text or structure, which go into the real files once approved.
 */
export function WardRedesign() {
  const root = useRef<HTMLDivElement | null>(null);
  useBusiestFlowList(root);
  return (
    <div ref={root} className={styles.ward}>
      <WardScreen unitId={WARD_ID} />
    </div>
  );
}
