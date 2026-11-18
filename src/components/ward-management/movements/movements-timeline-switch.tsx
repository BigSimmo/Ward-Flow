"use client";

/**
 * Graph or Table switch (Josh, 18 Nov 2026, D-265; replaces the M3 Shown/Hidden switch of 3 Nov and
 * Note 7 of 8 Nov). The 48-hour timeline keeps its place under the stage cards. One switch on its bar
 * swaps it for the people list in the same spot: "Graph" (the default) shows the timeline, "Table"
 * puts the worklist there instead. The choice is remembered on this device only; a stored "off" from
 * the old switch reads as "Table". The bar keeps the one fact worth seeing without the chart.
 */
import { useSyncExternalStore, type ReactNode } from "react";

import { Segmented } from "@/components/wf";
import s from "./movements-timeline-switch.module.css";

const KEY = "ward-flow-movements-timeline";

export type TrafficView = "graph" | "table";

function readPref(): TrafficView {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "off" || stored === "table" ? "table" : "graph";
  } catch {
    return "graph";
  }
}

const listeners = new Set<() => void>();
let memory: TrafficView | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The server render and hydration read "graph", then a stored "table" applies.
const snapshot = () => memory ?? readPref();
const serverSnapshot = (): TrafficView => "graph";

function setTrafficView(next: TrafficView) {
  memory = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Private window or blocked storage: the switch still works for this visit.
  }
  listeners.forEach((listener) => listener());
}

/** The remembered view, for the screen to put the worklist in the timeline's place. */
export function useTrafficView(): TrafficView {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function MovementsTimelineSwitch({
  summary,
  tableSummary,
  children,
}: {
  /** What the bar says while the graph shows (active corridors). */
  summary: string;
  /** What the bar says while the table shows instead. */
  tableSummary: string;
  children: ReactNode;
}) {
  const view = useTrafficView();
  return (
    <>
      <div className={s.bar} data-testid="movements-timeline-switch">
        <h2 className={s.title}>Today’s traffic</h2>
        <span className={s.summary}>{view === "graph" ? summary : tableSummary}</span>
        <Segmented
          label="Show today’s traffic as"
          items={[
            { id: "graph", label: "Graph" },
            { id: "table", label: "Table" },
          ]}
          value={view}
          onChange={setTrafficView}
        />
      </div>
      {view === "graph" ? children : null}
    </>
  );
}
