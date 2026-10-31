"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import {
  STATISTICS_COMMUNITY_CHOOSER_ID,
  STATISTICS_HOME_HREF,
  STATISTICS_SERVICE_CHOOSER_ID,
  STATISTICS_UNIT_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import type { StatisticsView } from "@/components/ward-management/statistics/statistics-view-bar";
import { Segmented } from "@/components/wf";

import styles from "./statistics-redesign.module.css";

/**
 * D-91 (Josh, 31 Oct 2026): Statistics had two "Open a unit" finders, the Summary's (wards, EDs,
 * services and teams) and Compare's (wards and EDs only). They are one now: the Summary's finder,
 * opened from "Open a unit" on the statistics tab row. Compare and the unit pages link here.
 *
 * Build note: `STATISTICS_UNIT_CHOOSER_HREF` (statistics-sections.ts) points at Compare today; it
 * becomes this address, so every "choose a ward" link lands on the one finder, already open.
 */
export const STATISTICS_UNIT_FINDER_HREF = `${STATISTICS_HOME_HREF}#${STATISTICS_UNIT_CHOOSER_ID}`;

/** Arriving at any of the finder's anchors opens it: units, health services and community teams. */
const FINDER_HASHES = [STATISTICS_UNIT_CHOOSER_ID, STATISTICS_SERVICE_CHOOSER_ID, STATISTICS_COMMUNITY_CHOOSER_ID].map(
  (id) => `#${id}`,
);
const subscribeToHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const finderInHash = () => FINDER_HASHES.includes(window.location.hash);

/** The one finder's open state: shut until asked for, open on arrival at one of its anchors. */
export function useUnitFinder() {
  const atFinder = useSyncExternalStore(subscribeToHash, finderInHash, () => false);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? atFinder;
  useEffect(() => {
    // The section track reaches a chooser through the app router, which changes the fragment
    // without a `hashchange`, so a click on such a link opens the finder too.
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href*='#']") : null;
      if (!link) return;
      const hash = new URL(link.getAttribute("href") ?? "", window.location.href).hash;
      if (FINDER_HASHES.includes(hash)) setToggled(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return { open, toggle: () => setToggled(!open) };
}

/** "Open a unit" on the statistics tab row: shows the finder in place under the hero. */
export function FindUnitTool({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.findTool}
      aria-expanded={open}
      aria-controls={STATISTICS_UNIT_CHOOSER_ID}
      onClick={onToggle}
      data-testid="ward-statistics-tool-open-unit"
    >
      <Search size={14} aria-hidden="true" />
      Open a unit
    </button>
  );
}

/** The same place on another Statistics page's tab row: a link to the one finder, opened. */
export function FindUnitLink({ testId }: { testId?: string }) {
  return (
    <Link href={STATISTICS_UNIT_FINDER_HREF} className={styles.findTool} data-testid={testId}>
      <Search size={14} aria-hidden="true" />
      Open a unit
    </Link>
  );
}

/**
 * Statistics, redesigned: Bed board, Journey and Map as one switch, not three large cards across a
 * full row. The one unit finder, when open from the tab row, sits above it.
 */
export function StatisticsViewSwitch({
  view,
  onChoose,
  finder,
  finderOpen = false,
}: {
  view: StatisticsView;
  onChoose: (view: StatisticsView) => void;
  /** Left out for a desk that may open no unit from it (the site bed manager). */
  finder?: ReactNode;
  finderOpen?: boolean;
}) {
  return (
    <div className={styles.switchBlock}>
      {finder !== undefined && finderOpen ? (
        <div id={STATISTICS_UNIT_CHOOSER_ID} className={styles.finder} tabIndex={-1}>
          {finder}
        </div>
      ) : null}
      <div className={styles.switchRow} data-testid="ward-statistics-view-bar">
        <Segmented
          label="Summary view"
          items={[
            { id: "board" as StatisticsView, label: "Bed board" },
            { id: "journey" as StatisticsView, label: "Journey" },
            { id: "map" as StatisticsView, label: "Map" },
          ]}
          value={view}
          onChange={onChoose}
          size="md"
        />
      </div>
    </div>
  );
}
