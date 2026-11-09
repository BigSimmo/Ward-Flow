"use client";

import { type RefObject, useEffect, useRef } from "react";
import styles from "./home-folder.module.css";

/**
 * Curved folder tabs (sticky header redesign, option A, Josh 9 Nov 2026). The page's light sheet and
 * the chosen list tab are one outline, so the tab rises out of the sheet with no seam. The outline is
 * a clip path drawn from where the chosen tab sits; when that tab is near the left edge it snaps to
 * the edge and becomes the sheet's own corner. It moves with the choice (280ms, or at once when the
 * phone asks for less motion). On a phone the tabs pin under the header: they then sit on slate and
 * the sheet's corners tighten.
 */

/** Tab top inset, tab height, tab corner, inner curve and sheet corner (px). */
const TAB_TOP = 8;
const TAB_HEIGHT = 48;
const TAB_RADIUS = 14;
const FILLET = 12;
const SHEET_RADIUS = 22;
const DOCKED_SHEET_RADIUS = 14;
const MOVE_MS = 280;

type Geometry = { width: number; height: number; x0: number; x1: number; sheetRadius: number };

/** The folder's outline as an SVG path, in the shape's own box. Exported for tests. */
export function folderPath({ width: W, height: H, x0: rawX0, x1, sheetRadius: R }: Geometry): string {
  const yT = TAB_TOP;
  const yS = TAB_TOP + TAB_HEIGHT;
  const r = TAB_RADIUS;
  const f = FILLET;
  const x0 = rawX0 < R + f ? 0 : rawX0;
  const right = Math.min(x1, W);
  const start =
    x0 === 0
      ? `M0,${H} L0,${yT + r} A${r},${r} 0 0 1 ${r},${yT}`
      : `M0,${H} L0,${yS + R} A${R},${R} 0 0 1 ${R},${yS} L${x0 - f},${yS} A${f},${f} 0 0 0 ${x0},${yS - f} L${x0},${yT + r} A${r},${r} 0 0 1 ${x0 + r},${yT}`;
  const end =
    right > W - R - f
      ? ` L${W - r},${yT} A${r},${r} 0 0 1 ${W},${yT + r} L${W},${H} Z`
      : ` L${right - r},${yT} A${r},${r} 0 0 1 ${right},${yT + r} L${right},${yS - f} A${f},${f} 0 0 0 ${right + f},${yS} L${W - R},${yS} A${R},${R} 0 0 1 ${W},${yS + R} L${W},${H} Z`;
  return `${start}${end}`;
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The outline behind Home's list tabs. Put it first inside the tab row (`navRef`); it measures the
 * hero above to run edge to edge, and the chosen `[role="radio"]` inside the row for the tab.
 */
export function HomeFolderShape({ navRef, value }: { navRef: RefObject<HTMLElement | null>; value: string }) {
  const shapeRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const shown = useRef<{ x0: number; x1: number } | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    const shape = shapeRef.current;
    const back = backRef.current;
    if (!nav || !shape || !back) return;
    let frame = 0;
    let docked = false;
    const reduce =
      typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    const target = () => {
      const navBox = nav.getBoundingClientRect();
      const hero = nav.parentElement?.querySelector<HTMLElement>("[data-wf-hero]");
      const heroBox = hero?.getBoundingClientRect();
      const left = heroBox ? heroBox.left - navBox.left : 0;
      const width = heroBox ? heroBox.width : navBox.width;
      const tab = nav.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
      const tabBox = tab?.getBoundingClientRect();
      const x0 = tabBox ? tabBox.left - navBox.left - left : 0;
      const x1 = tabBox ? tabBox.right - navBox.left - left : 0;
      return { left, width, x0, x1 };
    };

    const paint = (left: number, width: number, x0: number, x1: number) => {
      const height = TAB_TOP + TAB_HEIGHT + SHEET_RADIUS;
      const path = folderPath({
        width: round(width),
        height,
        x0: round(x0),
        x1: round(x1),
        sheetRadius: docked ? DOCKED_SHEET_RADIUS : SHEET_RADIUS,
      });
      for (const node of [shape, back]) {
        node.style.left = `${round(left)}px`;
        node.style.width = `${round(width)}px`;
      }
      shape.style.clipPath = `path("${path}")`;
      shown.current = { x0, x1 };
    };

    const place = (animate: boolean) => {
      cancelAnimationFrame(frame);
      const { left, width, x0, x1 } = target();
      const from = shown.current;
      if (!animate || !from || reduce?.matches || (from.x0 === x0 && from.x1 === x1)) {
        paint(left, width, x0, x1);
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / MOVE_MS);
        const ease = 1 - (1 - t) ** 3;
        paint(left, width, from.x0 + (x0 - from.x0) * ease, from.x1 + (x1 - from.x1) * ease);
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    // A phone pins the tabs under the header; pinned, they sit on slate.
    const checkDocked = () => {
      const style = getComputedStyle(nav);
      const pinned = style.position === "sticky" && nav.getBoundingClientRect().top <= parseFloat(style.top) + 0.5;
      if (pinned === docked) return;
      docked = pinned;
      nav.toggleAttribute("data-docked", pinned);
      place(false);
    };

    place(shown.current !== null);
    checkDocked();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => place(false));
    resize?.observe(nav);
    document.addEventListener("scroll", checkDocked, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      document.removeEventListener("scroll", checkDocked, { capture: true });
    };
  }, [navRef, value]);

  return (
    <>
      <div ref={backRef} className={styles.back} aria-hidden="true" />
      <div ref={shapeRef} className={styles.shape} aria-hidden="true" />
    </>
  );
}
