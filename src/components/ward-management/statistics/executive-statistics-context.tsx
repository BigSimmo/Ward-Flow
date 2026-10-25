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

/** Controlled memory only: no storage, operational state fallback, effects or schema-library import. */
export function ExecutiveStatisticsProvider({
  binding,
  snapshot,
  now,
  children,
}: {
  binding: ExecutiveReportingBinding | null;
  snapshot: ExecutiveReportingSnapshot | null;
  now: number;
  children: ReactNode;
}) {
  return (
    <ExecutiveStatisticsContext.Provider value={selectExecutiveReportingSnapshot(binding, snapshot, now)}>
      {children}
    </ExecutiveStatisticsContext.Provider>
  );
}

export function useExecutiveStatistics(): ExecutiveReportingFoundation | null {
  return useContext(ExecutiveStatisticsContext);
}
