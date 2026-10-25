import type { AuditDecision } from "@/components/ward-management/ward-audit";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { BedEventHelpers, WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import type { BedRelease } from "@/components/ward-management/ward-model";
import {
  DISCHARGE_DEPENDENCY_KINDS,
  DISCHARGE_DEPENDENCY_OWNERS,
  DISCHARGE_DEPENDENCY_STATES,
  type DischargeDependency,
  type DischargeDependencyKind,
  type DischargeDependencyOwner,
  type DischargeDependencyState,
  type DischargePlanChange,
} from "./discharge-dependencies";

/**
 * Closing-the-loop package B (24 Oct 2026): the two recorded events behind the discharge
 * dependency list. Part of `WardFlowEvent`, declared here beside their reducer so the shared event
 * file stays small. Neither carries typed text, and neither changes a release's stage, its blocker
 * or any bed figure: logistics only.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type DischargeDependencyEvent =
  | {
      /**
       * Record one item on a discharge: what it is, who owns it, and whether it is outstanding,
       * done or not needed. Recording a done item again is how a person reconfirms it after a
       * change. Ward-scoped: `actingUnitId` must be the release's own ward.
       */
      type: "RECORD_DISCHARGE_DEPENDENCY";
      role: WardFlowRole;
      now: Instant;
      releaseId: string;
      actingUnitId: string;
      kind: DischargeDependencyKind;
      owner: DischargeDependencyOwner;
      state: DischargeDependencyState;
    }
  | {
      /**
       * Record a change to the planned discharge: a new expected time, or where the person is going.
       * Exactly one of the two. Any done item that relied on the old fact is then shown as needing
       * checking again; nothing is cancelled.
       */
      type: "RECORD_DISCHARGE_PLAN_CHANGE";
      role: WardFlowRole;
      now: Instant;
      releaseId: string;
      actingUnitId: string;
      expectedAt?: Instant;
      leavingDestination?: LeavingDestination;
    };

const DESTINATION_IDS: readonly LeavingDestination[] = LEAVING_DESTINATIONS.map((option) => option.id);

export function reduceDischargeDependencyEvent(
  state: WardFlowState,
  event: DischargeDependencyEvent,
  decision: AuditDecision,
  { findBedRelease, findUnit, recordedByLabel, reject, replaceBedRelease }: BedEventHelpers,
): WardFlowState {
  const release = findBedRelease(state, event.releaseId);
  if (!release) return reject(state, event, "This discharge could not be found, so nothing was recorded.");
  if (release.state === "discharged") {
    return reject(state, event, "This person has already left, so nothing was recorded.");
  }
  // Claim, not proof, as SEND_RELEASE_SUPPORT_NOTICE: a ward records only for its own release.
  const unit = findUnit(state, release.unitId);
  if (event.actingUnitId !== release.unitId) {
    return reject(state, event, `This discharge belongs to ${unit?.name ?? "another ward"}. Record it as that ward.`);
  }
  const by = recordedByLabel(event.role, unit?.name ?? release.unitId);

  if (event.type === "RECORD_DISCHARGE_DEPENDENCY") {
    // Chosen, never typed: the runtime half of the union-type checks, for an untyped caller.
    if (
      !DISCHARGE_DEPENDENCY_KINDS.includes(event.kind) ||
      !DISCHARGE_DEPENDENCY_OWNERS.includes(event.owner) ||
      !DISCHARGE_DEPENDENCY_STATES.includes(event.state)
    ) {
      return reject(state, event, "Choose what it is, who owns it and where it stands.");
    }
    const list = release.dependencies ?? [];
    const existing = list.find((item) => item.kind === event.kind);
    if (existing?.state === "outstanding" && event.state === "outstanding" && existing.owner === event.owner) {
      return reject(state, event, "This is already recorded as outstanding.");
    }
    const item: DischargeDependency = { kind: event.kind, owner: event.owner, state: event.state, at: event.now, by };
    decision.outcome = "accepted";
    decision.reasonCode = "none";
    const dependencies = existing
      ? list.map((candidate) => (candidate.kind === event.kind ? item : candidate))
      : [...list, item];
    return replaceBedRelease(state, release.id, { ...release, dependencies });
  }

  const hasDate = event.expectedAt !== undefined;
  const hasDestination = event.leavingDestination !== undefined;
  if (hasDate === hasDestination) {
    return reject(state, event, "Change either the expected time or the destination.");
  }
  let updated: BedRelease;
  let change: DischargePlanChange | null = null;
  if (hasDate) {
    const expectedAt = event.expectedAt as Instant;
    if (typeof expectedAt !== "number" || !Number.isFinite(expectedAt)) {
      return reject(state, event, "Enter a valid expected time.");
    }
    if (expectedAt === release.expectedAt) return reject(state, event, "That is already the expected time.");
    change = { fact: "expected_date", previousExpectedAt: release.expectedAt, expectedAt, at: event.now, by };
    updated = { ...release, expectedAt };
  } else {
    const destination = event.leavingDestination as LeavingDestination;
    if (!DESTINATION_IDS.includes(destination)) return reject(state, event, "Choose a destination.");
    const previous = release.plannedDestination;
    if (previous?.leavingDestination === destination)
      return reject(state, event, "That destination is already recorded.");
    // A first destination is a confirmation, not a change; a later one is both.
    if (previous) {
      change = {
        fact: "destination",
        previousLeavingDestination: previous.leavingDestination,
        leavingDestination: destination,
        at: event.now,
        by,
      };
    }
    updated = { ...release, plannedDestination: { leavingDestination: destination, at: event.now, by } };
  }
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return replaceBedRelease(state, release.id, {
    ...updated,
    ...(change ? { planChanges: [...(release.planChanges ?? []), change] } : {}),
  });
}
