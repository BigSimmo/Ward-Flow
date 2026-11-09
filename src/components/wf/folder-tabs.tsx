"use client";

import { type ReactNode, type RefObject, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { cx } from "./cx";
import styles from "./folder-tabs.module.css";

/**
 * Curved folder tabs (sticky header redesign, option A, Josh 9 Nov 2026). The page's light sheet and
 * the chosen list tab are one outline, so the tab rises out of the sheet with no seam. The outline is
 * a clip path drawn from where the chosen tab sits; when that tab is near the left edge it snaps to
 * the edge and becomes the sheet's own corner. It moves with the choice (280ms, or at once when the
 * phone asks for less motion). On a phone the tabs pin under the header: they then sit on slate and
 * the sheet's corners tighten.
 */

/** Tab top inset, tab height, tab corner, inner curve and sheet corner (px). Compact (Josh, 9 Nov 2026). */
const TAB_TOP = 6;
const TAB_HEIGHT = 40;
const TAB_RADIUS = 12;
const FILLET = 10;
const SHEET_RADIUS = 20;
const DOCKED_SHEET_RADIUS = 12;
const MOVE_MS = 280;

type Geometry = { width: number; height: number; x0: number; x1: number; sheetRadius: number };

/** The folder's outline as an SVG path, in the shape's own box. */
function folderPath({ width: W, height: H, x0: rawX0, x1, sheetRadius: R }: Geometry): string {
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
 * The outline behind a folder tab row (`navRef`). `FolderTabs` draws it for you; it measures the hero
 * above (a sibling `[data-wf-hero]`) to run edge to edge, and the chosen tab in the row's switch.
 */
function FolderShape({ navRef, value }: { navRef: RefObject<HTMLElement | null>; value: string }) {
  const shapeRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const shown = useRef<{ x0: number; x1: number } | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    const shape = shapeRef.current;
    const back = backRef.current;
    if (!nav || !shape || !back) return;
    let frame = 0;
    let moving = false;
    // Read back from the row, so a tab switch while pinned keeps the slate and its 280ms move.
    let docked = nav.hasAttribute("data-docked");
    const reduce =
      typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    const target = () => {
      const navBox = nav.getBoundingClientRect();
      const hero = nav.parentElement?.querySelector<HTMLElement>("[data-wf-hero]");
      const heroBox = hero?.getBoundingClientRect();
      const left = heroBox ? heroBox.left - navBox.left : 0;
      const width = heroBox ? heroBox.width : navBox.width;
      // The first tab starts at the sheet's own edge, so its label sits centred in the folder.
      nav.style.setProperty("--wf-folder-bleed", `${Math.max(0, round(-left))}px`);
      // The chosen tab of the primary switch (a Segmented radio, a PillTabs tab, or a Segmented of links,
      // whose chosen link carries aria-current="page", or a section jump aria-current="true").
      const tab =
        nav.querySelector<HTMLElement>(
          `.${styles.switch} > [aria-checked="true"], .${styles.switch} > [aria-selected="true"], .${styles.switch} > [aria-current="page"], .${styles.switch} > [aria-current="true"]`,
        ) ?? nav.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
      const tabBox = tab?.getBoundingClientRect();
      const x0 = tabBox ? tabBox.left - navBox.left - left : 0;
      const x1 = tabBox ? tabBox.right - navBox.left - left : 0;
      return { left, width, x0, x1 };
    };

    const paint = (left: number, width: number, x0: number, x1: number) => {
      // The sheet's top edge runs on below the row by its corner, over whatever follows.
      const sheetRadius = docked ? DOCKED_SHEET_RADIUS : SHEET_RADIUS;
      const height = TAB_TOP + TAB_HEIGHT + sheetRadius;
      const path = folderPath({ width: round(width), height, x0: round(x0), x1: round(x1), sheetRadius });
      shape.style.height = `${height}px`;
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
      moving = true;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / MOVE_MS);
        const ease = 1 - (1 - t) ** 3;
        paint(left, width, from.x0 + (x0 - from.x0) * ease, from.x1 + (x1 - from.x1) * ease);
        if (t < 1) frame = requestAnimationFrame(step);
        else moving = false;
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
    let sized = false;
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            // The observer reports once as it starts; that first report would cut short the move above.
            // Unless the row changed before that report came (a phone's shorter tab list after hydration).
            if (!sized) {
              sized = true;
              if (moving) return;
            }
            // A resize can unpin the row (say phone to tablet), so docking is checked again first.
            checkDocked();
            place(false);
          });
    resize?.observe(nav);
    // The switch can change width without the row doing so (a phone's shorter tab list after hydration),
    // and a phone row that scrolls sideways carries the chosen tab with it.
    const follow = () => place(false);
    let tabSwitch: HTMLElement | null = null;
    const watchSwitch = () => {
      const next = nav.querySelector<HTMLElement>(`.${styles.switch}`);
      if (next === tabSwitch) return;
      tabSwitch?.removeEventListener("scroll", follow);
      tabSwitch = next;
      if (!next) return;
      resize?.observe(next);
      next.addEventListener("scroll", follow, { passive: true });
    };
    watchSwitch();
    // The row's tabs can be swapped or relabelled after mount (a phone's own tab list, a count that
    // arrives), so the outline follows any change inside the row.
    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            watchSwitch();
            if (!moving) place(false);
          });
    mutations?.observe(nav, { childList: true, subtree: true, characterData: true });
    // A tab's size or the row's bleed can ease into place (any transition, even reduced motion's
    // near-zero one), so the outline is measured again once it has settled.
    const settled = () => {
      if (!moving) place(false);
    };
    nav.addEventListener("transitionend", settled);
    // The hero above can settle after mount (its gutter bleed or a phone layout swap), so it is watched too,
    // and the chosen tab is measured again once the web fonts have loaded.
    const hero = nav.parentElement?.querySelector<HTMLElement>("[data-wf-hero]");
    if (hero) resize?.observe(hero);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live && !moving) place(false);
    });
    document.addEventListener("scroll", checkDocked, { capture: true, passive: true });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutations?.disconnect();
      nav.removeEventListener("transitionend", settled);
      tabSwitch?.removeEventListener("scroll", follow);
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

/**
 * Class names a page puts on its own parts of a folder tab row: `switch` on the primary tab control
 * (PillTabs or Segmented), `hero` on the `Hero` just above the row (it makes room for the folder and
 * steps the band's lip aside on phone and tablet), `rule` on an optional divider before filters, and
 * `more` on a More button.
 */
export const folderTabClasses = {
  switch: styles.switch,
  hero: styles.hero,
  rule: styles.rule,
  filters: styles.filters,
  more: styles.more,
} as const;

export type FolderTabsProps = {
  /** The row's accessible name ("Home lists"). */
  label: string;
  /** The chosen tab's id; the folder moves when it changes. */
  value: string;
  /**
   * An act-now count sits on a tab: that tab's count becomes a 16px deep red circle. `true` means the
   * first tab; a number 1 to 4 names the tab.
   */
  act?: boolean | 1 | 2 | 3 | 4;
  /** The primary switch (with `folderTabClasses.switch`), then any rule and filters. */
  children: ReactNode;
  /** Drawn last, on the right (a More menu). */
  more?: ReactNode;
  className?: string;
  testId?: string;
};

/**
 * Page tabs (Josh, 9 Nov 2026): curved folder tabs rising out of the slate on a phone and tablet,
 * underline tabs on the light page from 64rem. Render it as the next sibling of the page's `Hero`
 * (with `folderTabClasses.hero` on the hero).
 */
export const FolderTabs = forwardRef<HTMLElement, FolderTabsProps>(function FolderTabs(
  { label, value, act, children, more, className, testId },
  ref,
) {
  const navRef = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => navRef.current as HTMLElement);
  return (
    <nav
      ref={navRef}
      className={cx(styles.nav, className)}
      aria-label={label}
      data-testid={testId}
      data-act={act ? String(act === true ? 1 : act) : undefined}
      data-wf-folder=""
    >
      {children}
      <FolderShape navRef={navRef} value={value} />
      {more ? <div className={styles.moreSlot}>{more}</div> : null}
    </nav>
  );
});
