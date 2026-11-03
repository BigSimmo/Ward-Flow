"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import type { WardFlowState } from "../ward-flow-reducer";
import type { EventLogEntry } from "../ward-event-log";
import type { WardAccess } from "../ward-role-access";
import { wardPlaceLookup } from "../ward-access-places";
import { WF_PHONE_QUERY } from "@/components/wf";
import {
  ExecutiveStatisticsLivePreviewProvider,
  type ExecutiveLivePreviewProjection,
} from "../statistics/executive-statistics-context";

/** The phone header's resting height (ward-bar.module.css), in CSS pixels. */
const PHONE_BAR_REST_PX = 56;

/**
 * Q297 (pre-launch A1, 2 Nov 2026): with large text the phone header grows past its 56px. The pinned
 * rows below it stick at `--wf-header-height`, so while it is taller that variable follows its real
 * height on the scroller (`[data-wf-scroller]`); at its resting height the layout's own value
 * stands. Desktop is never touched.
 */
function useHeaderHeightSync(header: HTMLElement | null) {
  useEffect(() => {
    if (!header || typeof ResizeObserver === "undefined" || typeof window.matchMedia !== "function") return;
    const host = header.closest<HTMLElement>("[data-wf-scroller]") ?? header.parentElement;
    if (!host) return;
    const phone = window.matchMedia(WF_PHONE_QUERY);
    const sync = () => {
      const height = header.getBoundingClientRect().height;
      if (phone.matches && height > PHONE_BAR_REST_PX + 0.5) {
        host.style.setProperty("--wf-header-height", `${Math.ceil(height)}px`);
      } else {
        host.style.removeProperty("--wf-header-height");
      }
    };
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    phone.addEventListener?.("change", sync);
    sync();
    return () => {
      observer.disconnect();
      phone.removeEventListener?.("change", sync);
      host.style.removeProperty("--wf-header-height");
    };
  }, [header]);
}

/** Shared presentational elements retain the existing chrome DOM and attributes. */
export function WardBarFrame({ ref, ...props }: ComponentProps<"header">) {
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      setHeader(node);
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  useHeaderHeightSync(header);
  return <header {...props} ref={setRef} />;
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
  // A projector that fails to load is not "still loading": the desk then reads as unavailable.
  const [importFailed, setImportFailed] = useState(false);
  const [held, setHeld] = useState<ExecutiveLivePreviewProjection | null>(null);
  useEffect(() => {
    let current = true;
    // The private projector is loaded only on this explicit preview path, not normal phone startup.
    void import("../statistics/executive-statistics-projector").then(
      ({ projectExecutiveReportingFoundation }) => {
        if (current) setProjector({ project: projectExecutiveReportingFoundation });
      },
      () => {
        if (current) setImportFailed(true);
      },
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
      // Loading only until the projector arrives. A projection that throws is unavailable, not loading.
      loading={held === null && projector === null && !importFailed}
      controls={{
        paused: held !== null,
        togglePause: selected ? () => setHeld((value) => (value ? null : live)) : null,
      }}
    >
      {children}
    </ExecutiveStatisticsLivePreviewProvider>
  );
}
