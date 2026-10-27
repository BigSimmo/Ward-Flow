import {
  isExecutiveReportingFoundation,
  type ExecutiveReportingFoundation,
} from "./statistics/executive-statistics-contract";
import type { SharedSnapshot } from "./ward-shared-client";

/** Disjoint from an operational board. This module loads only for an aggregate response. */
export type ExecutiveAggregateSnapshot = {
  kind: "executive-aggregate";
  dataMode: "prototype";
  actorId: string;
  revision: number;
  accessContext: string;
  accessUntil: number;
  now: number;
  report: ExecutiveReportingFoundation;
  demoControls: false;
};

export type SharedWorkspaceSnapshot = SharedSnapshot | ExecutiveAggregateSnapshot;

const fields = [
  "kind",
  "dataMode",
  "actorId",
  "revision",
  "accessContext",
  "accessUntil",
  "now",
  "report",
  "demoControls",
];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The response and authenticated connection supply authority; the report cannot grant itself access.
 * Deadlines have already been translated by the existing onDeviceClock response boundary. */
export function bindExecutiveAggregateSnapshot(
  value: unknown,
  outer: { actorId?: unknown; access?: unknown; accessUntil?: unknown },
  authenticatedActorId: string | null | undefined,
  deviceNow: number,
): ExecutiveAggregateSnapshot | null {
  if (
    !object(value) ||
    Object.keys(value).length !== fields.length ||
    !fields.every((key) => Object.hasOwn(value, key)) ||
    value.kind !== "executive-aggregate" ||
    value.dataMode !== "prototype" ||
    value.demoControls !== false ||
    !authenticatedActorId ||
    value.actorId !== authenticatedActorId ||
    outer.actorId !== authenticatedActorId ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    typeof value.accessContext !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.accessContext) ||
    typeof value.now !== "number" ||
    !Number.isFinite(value.now) ||
    typeof value.accessUntil !== "number" ||
    !Number.isFinite(value.accessUntil) ||
    value.accessUntil <= deviceNow ||
    typeof outer.accessUntil !== "number" ||
    !Number.isFinite(outer.accessUntil) ||
    outer.accessUntil <= deviceNow ||
    !Number.isFinite(deviceNow) ||
    !object(outer.access) ||
    outer.access.role !== "executive" ||
    !object(outer.access.scope) ||
    !isExecutiveReportingFoundation(value.report)
  )
    return null;
  const scope = outer.access.scope;
  const reportScope = value.report.network.scope;
  if (
    (scope.kind !== "statewide" && scope.kind !== "service") ||
    scope.kind !== reportScope.kind ||
    (reportScope.kind === "service" && scope.service !== reportScope.service) ||
    value.now !== value.report.network.asAt.now
  )
    return null;
  // Independent copies prevent consumers mutating a later retained report. No operational data is copied.
  const snapshot = structuredClone(value) as ExecutiveAggregateSnapshot;
  snapshot.accessUntil = Math.min(snapshot.accessUntil, outer.accessUntil);
  const freeze = (entry: unknown): void => {
    if (!entry || typeof entry !== "object" || Object.isFrozen(entry)) return;
    Object.values(entry).forEach(freeze);
    Object.freeze(entry);
  };
  freeze(snapshot);
  return snapshot;
}
