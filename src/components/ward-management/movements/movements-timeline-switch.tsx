"use client";

/**
 * Timeline switch (M3, approved 3 Nov 2026). Movements leads with its worklist, so the day's
 * timeline sits behind one switch on a tablet or laptop, as it already does on a phone. The bar
 * keeps the one fact worth seeing without the chart (how many corridors are active) and remembers
 * the choice on this device only.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { ChartGantt } from "lucide-react";

import { Switch } from "@/components/wf";
import s from "./movements-timeline-switch.module.css";

const KEY = "wf.movements.timeline";

function readPref(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();
let memory: boolean | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The server render and hydration read "hidden", then the stored choice applies.
const snapshot = () => memory ?? readPref();
const serverSnapshot = () => false;

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
      <div className={s.bar} data-open={on ? "true" : undefined}>
        <span className={s.icon}>
          <ChartGantt size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className={s.title}>Timeline</span>
        <span className={s.summary}>{summary}</span>
        <Switch checked={on} onCheckedChange={change} label="Show timeline" onText="Shown" offText="Hidden" />
      </div>
      {on ? children : null}
    </>
  );
}
