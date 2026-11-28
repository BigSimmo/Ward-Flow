"use client";

import { useLayoutEffect, useRef } from "react";

import { HeroTrack, Segmented, folderTabClasses } from "@/components/wf";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";

import styles from "./find-screen.module.css";
import { PLACES_CATCHMENTS_HREF, PLACES_HREF } from "./places-hrefs";

/**
 * Find (mock-up, 26 Nov 2026): Search, All wards, All EDs and the community teams index as the four
 * tabs of one page at the Places address. Each tab is that page as designed, its own hero and body;
 * the one new part is this switch, which leads each page's folder tab row (the house position for a
 * page-level switch, as Places and Catchments did). The tab lives in the address (`?tab=`), so each
 * switch is a history entry and Back returns to the tab before.
 */
export type FindTab = "people" | "wards" | "eds" | "teams" | "suburbs";

export const FIND_TABS: readonly { id: FindTab; label: string; gate: string }[] = [
  // `gate` is the standalone page whose access the tab follows: a desk that may not open it does not get the tab.
  { id: "people", label: "People", gate: "/bedchart/search" },
  { id: "wards", label: "Wards", gate: "/bedchart/wards" },
  { id: "eds", label: "EDs", gate: "/bedchart/ed" },
  { id: "teams", label: "Community teams", gate: PLACES_CATCHMENTS_HREF },
  // The suburb lookup and Read alike, which lived at Catchments: it prevents a referral to the wrong team.
  { id: "suburbs", label: "Suburbs", gate: PLACES_CATCHMENTS_HREF },
];

export function isFindTab(value: unknown): value is FindTab {
  return FIND_TABS.some((tab) => tab.id === value);
}

/** People is the first tab and the bare address; the others carry `?tab=`. */
export function findHref(tab: FindTab): string {
  return tab === "people" ? PLACES_HREF : `${PLACES_HREF}?tab=${tab}`;
}

/** The tabs this desk may open, in their fixed order. */
export function useFindTabs(): readonly { id: FindTab; label: string }[] {
  const canOpen = useCanOpenHref();
  return FIND_TABS.filter((tab) => canOpen(tab.gate));
}

/** The switch itself: route links, so the chosen one carries aria-current and the folder follows it. */
export function FindSwitch({ value }: { value: FindTab }) {
  const tabs = useFindTabs();
  return (
    <Segmented<FindTab>
      className={folderTabClasses.switch}
      // Its own landmark name: the row's nav keeps the page's, and two navs may not share one (axe).
      label="Find"
      size="md"
      value={value}
      items={tabs.map((tab) => ({ id: tab.id, label: tab.label, href: findHref(tab.id) }))}
    />
  );
}

/**
 * The same tabs at the top of the dark hero (plan of record, 26 Nov 2026): the row sits above each tab's
 * own hero content, so it never moves between tabs and no band is padded to match another.
 */
export function FindHeroTabs({ value }: { value: FindTab }) {
  const tabs = useFindTabs();
  const rowRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const hero = row.closest<HTMLElement>("[data-wf-hero]");
    // The chosen tab comes into view in the row only: the row's own scroll moves, never the page's.
    const active = row.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) {
      const rowBox = row.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      if (box.right > rowBox.right) row.scrollLeft += box.right - rowBox.right + 16;
      else if (box.left < rowBox.left) row.scrollLeft -= rowBox.left - box.left + 16;
    }
    // A row cut at either edge fades into the hero there.
    const fade = () => {
      const max = row.scrollWidth - row.clientWidth;
      row.toggleAttribute("data-fade-start", row.scrollLeft > 1);
      row.toggleAttribute("data-fade-end", max > 1 && row.scrollLeft < max - 1);
    };
    // Phone: the Live chip sits at the right of the title line, as on the page before Find, not on a
    // line of its own above the tabs. The hero is told where that line is.
    const place = () => {
      fade();
      const title = hero?.querySelector<HTMLElement>("[data-wf-hero-title-line]");
      if (!hero) return;
      if (!title) {
        // Audit two (B12): a tab whose hero has no title line yet still keeps the chip off the switch,
        // 4px under the row, instead of at the hero's top where the tabs are.
        const under = row.getBoundingClientRect().bottom - hero.getBoundingClientRect().top - hero.clientTop;
        hero.style.setProperty("--find-title-top", `${Math.round(under + 4)}px`);
        return;
      }
      const top = title.getBoundingClientRect().top - hero.getBoundingClientRect().top - hero.clientTop;
      const line = Math.min(title.getBoundingClientRect().height, 24);
      hero.style.setProperty("--find-title-top", `${Math.round(top + (line - 22) / 2)}px`);
    };
    place();
    row.addEventListener("scroll", fade, { passive: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    resize?.observe(row);
    if (hero) resize?.observe(hero);
    // A title line that mounts after this runs (a tab's hero filling in) re-places the chip.
    const mutations = !hero || typeof MutationObserver === "undefined" ? null : new MutationObserver(place);
    if (hero) mutations?.observe(hero, { childList: true, subtree: true });
    return () => {
      row.removeEventListener("scroll", fade);
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, [value, tabs.length]);
  return (
    <span ref={rowRef} className={styles.heroTabs}>
      <HeroTrack<FindTab>
        label="Find"
        size="md"
        value={value}
        items={tabs.map((tab) => ({ id: tab.id, label: tab.label, href: findHref(tab.id) }))}
      />
    </span>
  );
}
