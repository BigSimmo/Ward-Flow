"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ExecutiveReportingFoundation } from "./executive-statistics-contract";

export type ExecutiveReportingBinding = {
  actorId: string;
  accessContext: string;
  epoch: number;
  /** The host's accepted report revision, which may deliberately be held while paused. */
  revision: number;
};

export type ExecutiveReportingSnapshot = {
  binding: ExecutiveReportingBinding;
  receivedAt: number;
  /** Actual session/report lifetime supplied by the host; this module invents no expiry policy. */
  expiresAt: number;
  data: ExecutiveReportingFoundation;
};

function validBinding(binding: ExecutiveReportingBinding) {
  return (
    typeof binding.actorId === "string" &&
    binding.actorId.length > 0 &&
    typeof binding.accessContext === "string" &&
    /^[a-f0-9]{64}$/u.test(binding.accessContext) &&
    Number.isSafeInteger(binding.epoch) &&
    binding.epoch >= 0 &&
    Number.isSafeInteger(binding.revision) &&
    binding.revision > 0
  );
}

/** Already-network-validated DTO holder, not deep validation or an authorisation decision.
 * Current actor/access/epoch must always come from the host, including while a report is paused. */
export function selectExecutiveReportingSnapshot(
  binding: ExecutiveReportingBinding | null,
  snapshot: ExecutiveReportingSnapshot | null,
  now: number,
): ExecutiveReportingFoundation | null {
  if (
    !binding ||
    !snapshot ||
    !snapshot.binding ||
    !validBinding(binding) ||
    !validBinding(snapshot.binding) ||
    !Number.isFinite(now) ||
    !Number.isFinite(snapshot.receivedAt) ||
    !Number.isFinite(snapshot.expiresAt) ||
    snapshot.expiresAt <= snapshot.receivedAt ||
    now < snapshot.receivedAt ||
    now >= snapshot.expiresAt
  )
    return null;
  if (
    binding.actorId !== snapshot.binding.actorId ||
    binding.accessContext !== snapshot.binding.accessContext ||
    binding.epoch !== snapshot.binding.epoch ||
    binding.revision !== snapshot.binding.revision
  )
    return null;
  return snapshot.data;
}

const ExecutiveStatisticsContext = createContext<ExecutiveReportingFoundation | null>(null);
export type ExecutiveStatisticsControl = {
  /** Supplied by the host's current authenticated/preview role, including before data arrives. */
  executive: boolean;
  paused: boolean;
  /** Null means pause is unavailable; a screen must not offer an inert control. */
  togglePause: (() => void) | null;
};
/** `loading`: the executive view is still being worked out, so screens say so calmly instead of
 * "unavailable" (Josh, 31 Oct 2026: the unavailable line flashed on every executive start). */
const ExecutiveStatisticsControlContext = createContext<
  ExecutiveStatisticsControl & { ready: boolean; loading: boolean }
>({
  executive: false,
  paused: false,
  togglePause: null,
  ready: false,
  loading: false,
});

/** A live preview is computed from an already-authorised local/coordinator source. Its identity
 * is an in-memory source/generation object, never a forged transport actor, hash or deadline. */
export type ExecutiveLivePreviewProjection = {
  identity: object;
  data: ExecutiveReportingFoundation;
};
export function selectExecutiveLivePreview(
  enabled: boolean,
  identity: object | null,
  projection: ExecutiveLivePreviewProjection | null,
): ExecutiveReportingFoundation | null {
  return enabled && identity !== null && projection?.identity === identity ? projection.data : null;
}

/** Fully controlled, with no retained value or async work. The host validates current authority
 * and exact source identity before passing a completed projection or a deliberately paused one. */
export function ExecutiveStatisticsLivePreviewProvider({
  enabled,
  identity,
  projection,
  controls,
  children,
}: {
  enabled: boolean;
  identity: object | null;
  projection: ExecutiveLivePreviewProjection | null;
  controls?: Pick<ExecutiveStatisticsControl, "paused" | "togglePause">;
  children?: ReactNode;
}) {
  const data = selectExecutiveLivePreview(enabled, identity, projection);
  return (
    <ExecutiveStatisticsControlContext.Provider
      value={{
        executive: enabled,
        ready: data !== null,
        // The preview's projector loads on demand; until its first report the view is loading.
        loading: enabled && identity !== null && projection === null,
        paused: controls?.paused ?? false,
        togglePause: controls?.togglePause ?? null,
      }}
    >
      <ExecutiveStatisticsContext.Provider value={data}>{children}</ExecutiveStatisticsContext.Provider>
    </ExecutiveStatisticsControlContext.Provider>
  );
}

/** Controlled memory only: no storage, operational state fallback, effects or schema-library import. */
export function ExecutiveStatisticsProvider({
  binding,
  snapshot,
  now,
  controls,
  children,
}: {
  binding: ExecutiveReportingBinding | null;
  snapshot: ExecutiveReportingSnapshot | null;
  now: number;
  controls?: ExecutiveStatisticsControl & { loading?: boolean };
  children?: ReactNode;
}) {
  const data = controls?.executive === false ? null : selectExecutiveReportingSnapshot(binding, snapshot, now);
  const currentControls = controls ?? { executive: binding !== null, paused: false, togglePause: null };
  return (
    <ExecutiveStatisticsControlContext.Provider
      value={{ ...currentControls, ready: data !== null, loading: data === null && controls?.loading === true }}
    >
      <ExecutiveStatisticsContext.Provider value={data}>{children}</ExecutiveStatisticsContext.Provider>
    </ExecutiveStatisticsControlContext.Provider>
  );
}

export function useExecutiveStatistics(): ExecutiveReportingFoundation | null {
  return useContext(ExecutiveStatisticsContext);
}

/** Pause is host-owned so a held report never outlives the current role/access binding. */
export function useExecutiveStatisticsControl() {
  return useContext(ExecutiveStatisticsControlContext);
}
