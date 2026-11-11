// Review on PR #1599: the referral answer and arrival rows name one ward as a scalar `details.unitId`.
// A service's desk must never read another service's decline or arrival, on the server's scope or
// the browser's. Synthetic seed only.
import { describe, expect, it } from "vitest";

import type { AuditEvent } from "@/components/ward-management/ward-audit";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { coordinatorRecordScope } from "@/components/ward-management/ward-access-scope";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model-vocabulary";
import { unitInScope, type WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const places = wardPlaceLookup(seed.units);
const desk = (service: HealthService): WardAccess => ({ role: "coordinator", scope: { kind: "service", service } });
const scopeFor = (state: WardFlowState, access: WardAccess) =>
  scopeWardFlowState(state, access, { now: NOW_ANCHOR, places });

/** The first moving journey a service desk is sent, with a ward in its service and one outside it. */
function fixture() {
  for (const service of HEALTH_SERVICES) {
    const access = desk(service);
    const moving = scopeFor(seed, access).scoped.movements.find((movement) => movement.stage === "moving");
    const own = seed.units.find((unit) => places.unitService(unit.id) === service);
    const other = seed.units.find((unit) => {
      const named = places.unitService(unit.id);
      return named !== undefined && named !== service;
    });
    if (moving && own && other) return { access, moving, own, other };
  }
  throw new Error("the seed needs a service desk sent a moving journey");
}

/** Real rows from the reducer, copied to name one ward in the desk's service and one outside it. */
function rowsFor(event: WardFlowEvent, ownUnitId: string, otherUnitId: string) {
  const after = wardFlowReducer(seed, event);
  const row = after.auditEvents.at(-1)!;
  expect(row.category === "referral-answer" || row.category === "arrival").toBe(true);
  const copy = (suffix: string, unitId: string, sequence: number) =>
    ({
      ...structuredClone(row),
      id: `${row.id}-${suffix}`,
      sequence,
      actor: { ...row.actor, actingUnitId: null },
      details: { ...row.details, unitId },
    }) as AuditEvent;
  const own = copy("own", ownUnitId, row.sequence + 1);
  const other = copy("other", otherUnitId, row.sequence + 2);
  return { state: { ...after, auditEvents: [...after.auditEvents, own, other] }, own, other };
}

function expectScopedToOwnService(state: WardFlowState, access: WardAccess, own: AuditEvent, other: AuditEvent) {
  // The server's scope: what the desk is sent.
  const { state: sent, scoped } = scopeFor(state, access);
  const sentIds = sent.auditEvents.map((event) => event.id);
  expect(sentIds).toContain(own.id);
  expect(sentIds).not.toContain(other.id);
  // The browser's scope: what the desk's audit screens keep from a read.
  const unitIn = (unitId: string) => unitInScope(access.scope, unitId, places);
  const kept = coordinatorRecordScope(scoped, state.bedReleases, unitIn)
    .auditEvents([own, other])
    .map((event) => event.id);
  expect(kept).toEqual([own.id]);
}

describe("referral answer and arrival rows stay with their ward's service", () => {
  const { access, moving, own, other } = fixture();

  it("a desk never reads another service's ward decline", () => {
    const {
      state,
      own: mine,
      other: theirs,
    } = rowsFor(
      {
        type: "DECLINE",
        role: "coordinator",
        now: NOW_ANCHOR + 1,
        movementId: moving.id,
        unitId: own.id,
        reason: "capability_mismatch",
      } as WardFlowEvent,
      own.id,
      other.id,
    );
    expect(mine.category).toBe("referral-answer");
    expectScopedToOwnService(state, access, mine, theirs);
  });

  it("a desk never reads an arrival on another service's ward", () => {
    const {
      state,
      own: mine,
      other: theirs,
    } = rowsFor(
      { type: "PATIENT_ARRIVED", role: "coordinator", now: NOW_ANCHOR + 1, movementId: moving.id } as WardFlowEvent,
      own.id,
      other.id,
    );
    expect(mine.category).toBe("arrival");
    expectScopedToOwnService(state, access, mine, theirs);
  });

  it("a row with no ward recorded still follows its subject", () => {
    const { state, own: mine } = rowsFor(
      { type: "PATIENT_ARRIVED", role: "coordinator", now: NOW_ANCHOR + 1, movementId: moving.id } as WardFlowEvent,
      own.id,
      other.id,
    );
    const unnamed = { ...mine, id: `${mine.id}-unnamed`, details: { ...mine.details, unitId: null } } as AuditEvent;
    const withUnnamed = { ...state, auditEvents: [...state.auditEvents, unnamed] };
    expect(scopeFor(withUnnamed, access).state.auditEvents.map((event) => event.id)).toContain(unnamed.id);
  });
});
