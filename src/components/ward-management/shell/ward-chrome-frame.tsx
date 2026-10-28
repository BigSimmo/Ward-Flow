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
type Projector = typeof import("../statistics/executive-statistics-projector").projectExecutiveReportingFoundation;

/** The caller mounts this only for local demo or an authorised coordinator preview.
 * Actual executive transport never enters this component or constructs its source World. */
export function WardAuthorisedExecutivePreview({ source, children }: { source: PreviewSource; children: ReactNode }) {
  const identity = useMemo(() => ({ source }), [source]);
  const [projector, setProjector] = useState<{ project: Projector } | null>(null);
  const [held, setHeld] = useState<ExecutiveLivePreviewProjection | null>(null);
  useEffect(() => {
    let current = true;
    // The private projector is loaded only on this explicit preview path, not normal phone startup.
    void import("../statistics/executive-statistics-projector").then(
      ({ projectExecutiveReportingFoundation }) => {
        if (current) setProjector({ project: projectExecutiveReportingFoundation });
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);
  // Projected in render once the projector is loaded, so a new source (each demo tick) shows its
  // own report at once. An effect left one render with no report, which swapped the whole executive
  // shell for "unavailable" and closed any open tour or sheet. An older source's report is never shown.
  const live = useMemo<ExecutiveLivePreviewProjection | null>(() => {
    if (!projector || held) return null;
    try {
      const data = projector.project(source.state, source.access, {
        now: source.now,
        dayZero: source.dayZero,
        startedAt: source.startedAt,
        places: wardPlaceLookup(source.state.units),
        sessionEvents: source.events,
      });
      return { identity, data };
    } catch {
      return null;
    }
  }, [projector, held, identity, source]);
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
