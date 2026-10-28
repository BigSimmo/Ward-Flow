"use client";

import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import type { WardFlowState } from "../ward-flow-reducer";
import type { EventLogEntry } from "../ward-event-log";
import type { WardAccess } from "../ward-role-access";
import { wardPlaceLookup } from "../ward-access-places";
import {
  ExecutiveStatisticsLivePreviewProvider,
  type ExecutiveLivePreviewProjection,
} from "../statistics/executive-statistics-context";

/** Shared presentational elements retain the existing chrome DOM and attributes. */
export function WardBarFrame(props: ComponentProps<"header">) {
  return <header {...props} />;
}
// P084: the rail is a labelled complementary region holding the one "Ward Flow views" nav, so the
// outer landmark is an aside and no navigation landmark sits inside another.
export function WardRailFrame(props: ComponentProps<"aside">) {
  return <aside {...props} />;
}

type PreviewSource = {
  state: WardFlowState;
  access: WardAccess;
  now: number;
  dayZero: string;
  startedAt: string;
  events: readonly EventLogEntry[];
};

/** The caller mounts this only for local demo or an authorised coordinator preview.
 * Actual executive transport never enters this component or constructs its source World. */
export function WardAuthorisedExecutivePreview({ source, children }: { source: PreviewSource; children: ReactNode }) {
  const identity = useMemo(() => ({ source }), [source]);
  const [completed, setCompleted] = useState<ExecutiveLivePreviewProjection | null>(null);
  const [held, setHeld] = useState<ExecutiveLivePreviewProjection | null>(null);
  useEffect(() => {
    if (held) return;
    let current = true;
    // The private projector is loaded only on this explicit preview path, not normal phone startup.
    void import("../statistics/executive-statistics-projector").then(
      ({ projectExecutiveReportingFoundation }) => {
        if (!current) return;
        try {
          const data = projectExecutiveReportingFoundation(source.state, source.access, {
            now: source.now,
            dayZero: source.dayZero,
            startedAt: source.startedAt,
            places: wardPlaceLookup(source.state.units),
            sessionEvents: source.events,
          });
          if (current) setCompleted({ identity, data });
        } catch {
          if (current) setCompleted(null);
        }
      },
      () => {
        if (current) setCompleted(null);
      },
    );
    return () => {
      current = false;
    };
  }, [identity, source, held]);
  // Identity changes hide an older completion synchronously, before effect cleanup or import resolution.
  const live = completed?.identity === identity ? completed : null;
  const selected = held ?? live;
  return (
    <ExecutiveStatisticsLivePreviewProvider
      enabled
      identity={held?.identity ?? identity}
      projection={selected}
      controls={{
        paused: held !== null,
        togglePause: selected ? () => setHeld((value) => (value ? null : live)) : null,
      }}
    >
      {children}
    </ExecutiveStatisticsLivePreviewProvider>
  );
}
