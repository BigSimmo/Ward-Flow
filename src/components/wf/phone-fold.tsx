"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { OverlayPortal } from "./overlay-root";
import { SrOnly } from "./primitives";
import { useIsPhone } from "./use-is-phone";
import styles from "./phone-fold.module.css";

/*
 * Simplification C1 (Josh, 19 Oct 2026): fewer layers before the first person on a phone. Two parts:
 *
 * - `HeroCondensedLine`: once the page's dark summary card has scrolled away under the header, one
 *   dark line stays pinned under the header with the card's answer. A tap brings the card back.
 * - `PhoneFilterFold` (in `phone.tsx`, beside the sheet it opens): a page's filter chips fold into
 *   one Filter button that says how many filters are on and opens the same chips in a bottom sheet.
 *
 * Phone only. Neither part renders anything above 48rem, so desktop and tablet are unchanged.
 */

/* ---------- HeroCondensedLine ---------- */

/** The shared header, or nothing on a page without the shell. */
function headerOf(hero: HTMLElement): HTMLElement | null {
  const scroller = hero.closest<HTMLElement>("[data-wf-scroller]");
  return scroller?.querySelector<HTMLElement>("[data-wf-bar]") ?? document.querySelector<HTMLElement>("[data-wf-bar]");
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The one-line form of a hero, pinned under the header once the hero has scrolled out of view.
 *
 * While it shows, the page's own pinned rows (which sit at `--wf-header-height`) move down by its
 * height, so it never covers a pinned switch. That override is set on the hero's `<main>` only,
 * never on the header, and is removed as soon as the line hides.
 */
export function HeroCondensedLine({
  heroRef,
  children,
}: {
  /** The hero section this line stands in for. */
  heroRef: RefObject<HTMLElement | null>;
  /** One short line: the hero's answer, such as "9 on the psychiatry board · longest 1d 5h". */
  children: ReactNode;
}) {
  const isPhone = useIsPhone();
  const [shown, setShown] = useState(false);
  // Mounted only once it has been needed, so a page that never scrolls carries no second copy of
  // the answer (and a screen reader never meets one).
  const [mounted, setMounted] = useState(false);
  const [top, setTop] = useState(0);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!isPhone || !hero || typeof window === "undefined") {
      setShown(false);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const header = headerOf(hero);
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const rect = hero.getBoundingClientRect();
      // A hero with no height has not been laid out (or is hidden): never condense then.
      const away = rect.height > 0 && rect.bottom <= headerBottom;
      setTop(Math.max(0, Math.round(headerBottom)));
      setShown(away);
      if (away) setMounted(true);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    // Capture, so a scrolling work column is heard as well as the window.
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [heroRef, isPhone]);

  // Pinned rows move under the line while it shows, and back when it hides.
  useLayoutEffect(() => {
    const host = heroRef.current?.closest<HTMLElement>("main");
    const line = lineRef.current;
    if (!host) return;
    if (shown && line) host.style.setProperty("--wf-header-height", `${top + line.offsetHeight}px`);
    else host.style.removeProperty("--wf-header-height");
    return () => {
      host.style.removeProperty("--wf-header-height");
    };
  }, [heroRef, shown, top]);

  if (!isPhone || !mounted) return null;

  const backToSummary = () => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    // Focus follows the eye, without a second jump.
    const heading = hero.querySelector<HTMLElement>("h1, h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  };

  return (
    <OverlayPortal layer="overlay" name="Summary line">
      <div
        ref={lineRef}
        className={styles.line}
        data-shown={shown ? "true" : undefined}
        data-testid="wf-hero-condensed"
        style={{ top }}
        // Hidden lines leave the tab order and the accessibility tree (visibility in the CSS too).
        aria-hidden={shown ? undefined : true}
        inert={!shown}
      >
        <button type="button" className={styles.lineButton} onClick={backToSummary}>
          <span className={styles.lineText}>{children}</span>
          <SrOnly>. Show the summary</SrOnly>
          <ChevronUp size={16} aria-hidden="true" className={styles.lineIcon} />
        </button>
      </div>
    </OverlayPortal>
  );
}
