"use client";

import type { ReactNode } from "react";

import { Segmented } from "@/components/wf";
import { STATISTICS_HOME_HREF, STATISTICS_UNIT_CHOOSER_ID } from "./statistics-sections";
import type { StatisticsView } from "./statistics-view-bar";
import { ViewSwitchHost } from "./statistics-view-switch-slot";

import styles from "./statistics-view-switch.module.css";

/**
 * D-91 (Josh, 31 Oct 2026): Statistics had two "Open a unit" finders, the Summary's (wards, EDs,
 * services and teams) and Compare's (wards and EDs only). They are one now: the Summary's finder,
 * opened from "Open a unit" on the statistics tab row. Compare and the unit pages link here.
 *
 * `STATISTICS_UNIT_CHOOSER_HREF` (statistics-sections.ts) still points at Compare's own chooser until
 * the Compare page is rebuilt; this is the address of the one finder, already open.
 */
export const STATISTICS_UNIT_FINDER_HREF = `${STATISTICS_HOME_HREF}#${STATISTICS_UNIT_CHOOSER_ID}`;

/**
 * Bed board, Journey and Map as a compact switch in the head of the first card it changes (owner
 * polish, 3 Nov 2026), so it reads as that card's view switch, not a third row of tabs. Each view's
 * first card draws it (`useViewSwitchAction`, statistics-view-switch-slot.tsx). The one unit finder, when open from the tab row, sits
 * above the views.
 */
export function StatisticsViewSwitch({
  view,
  onChoose,
  finder,
  finderOpen = false,
  children,
}: {
  view: StatisticsView;
  onChoose: (view: StatisticsView) => void;
  /** Left out for a desk that may open no unit from it (the site bed manager). */
  finder?: ReactNode;
  finderOpen?: boolean;
  children: ReactNode;
}) {
  const control = (
    <div className={styles.switchControl} data-testid="ward-statistics-view-bar">
      <Segmented
        label="Summary view"
        items={[
          { id: "board" as StatisticsView, label: "Bed board" },
          { id: "journey" as StatisticsView, label: "Movement" },
          { id: "map" as StatisticsView, label: "Map" },
        ]}
        value={view}
        onChange={onChoose}
        size="sm"
      />
    </div>
  );
  return (
    <>
      {finder !== undefined && finderOpen ? (
        <div id={STATISTICS_UNIT_CHOOSER_ID} className={styles.finder} tabIndex={-1}>
          {finder}
        </div>
      ) : null}
      <ViewSwitchHost.Provider value={control}>{children}</ViewSwitchHost.Provider>
    </>
  );
}
