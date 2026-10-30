"use client";

// Forked from src/components/ward-redesign/statistics/statistics-view-switch.tsx (the coordinator's redesign).

import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { StatisticsView } from "@/components/ward-management/statistics/statistics-view-bar";
import { Button, Segmented } from "@/components/wf";

import styles from "@/components/ward-redesign/statistics/statistics-redesign.module.css";

/**
 * Statistics, redesigned: Bed board, Journey and Map as one switch, not three large cards across a
 * full row, and Open a unit as one button beside it rather than a panel repeating the menu. The
 * button shows today's unit finder in place, so finding a ward works exactly as now.
 */
export function StatisticsViewSwitch({
  view,
  onChoose,
  finder,
}: {
  view: StatisticsView;
  onChoose: (view: StatisticsView) => void;
  /** Left out for a desk that may open no unit from it (the site bed manager): no Open a unit button. */
  finder?: ReactNode;
}) {
  const [finderOpen, setFinderOpen] = useState(false);
  return (
    <div className={styles.switchBlock}>
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
        {finder === undefined ? null : (
          <Button
            variant="sec"
            size="sm"
            icon={Search}
            aria-expanded={finderOpen}
            onClick={() => setFinderOpen((open) => !open)}
          >
            Open a unit
          </Button>
        )}
      </div>
      {finderOpen ? <div className={styles.finder}>{finder}</div> : null}
    </div>
  );
}
