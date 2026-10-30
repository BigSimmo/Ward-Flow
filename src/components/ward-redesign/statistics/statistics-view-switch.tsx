"use client";

import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { StatisticsView } from "@/components/ward-management/statistics/statistics-view-bar";
import { Button, Segmented } from "@/components/wf";

import styles from "./statistics-redesign.module.css";

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
  finder: ReactNode;
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
        <Button
          variant="sec"
          size="sm"
          icon={Search}
          aria-expanded={finderOpen}
          onClick={() => setFinderOpen((open) => !open)}
        >
          Open a unit
        </Button>
      </div>
      {finderOpen ? <div className={styles.finder}>{finder}</div> : null}
    </div>
  );
}
