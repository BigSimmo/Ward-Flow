"use client";

/**
 * Timeline switch (M3, approved 3 Nov 2026). The day's timeline sits behind one switch on a tablet
 * or laptop. Josh's Note 7 (8 Nov 2026): it is shown by default; hiding it is remembered on this
 * device only. The bar keeps the one fact worth seeing without the chart (active corridors).
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { ChartGantt } from "lucide-react";

import { IconTile } from "@/components/wf";

import { Switch } from "@/components/wf";
import s from "./movements-timeline-switch.module.css";

const KEY = "ward-flow-movements-timeline";

function readPref(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

const listeners = new Set<() => void>();
let memory: boolean | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The server render and hydration read "shown", then a stored "off" applies.
const snapshot = () => memory ?? readPref();
const serverSnapshot = () => true;

export function MovementsTimelineSwitch({ summary, children }: { summary: string; children: ReactNode }) {
  const on = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const change = (next: boolean) => {
    memory = next;
    try {
      window.localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      // Private window or blocked storage: the switch still works for this visit.
    }
    listeners.forEach((listener) => listener());
  };
  return (
    <>
      <div className={s.bar} data-open={on ? "true" : undefined} data-testid="movements-timeline-switch">
        {/* Movements audit item 9 (9 Nov 2026): the same icon tile and title as every section. */}
        <IconTile icon={ChartGantt} />
        <span className={s.title}>Timeline</span>
        <span className={s.summary}>{summary}</span>
        <Switch checked={on} onCheckedChange={change} label="Show timeline" onText="Shown" offText="Hidden" />
      </div>
      {on ? children : null}
    </>
  );
}
