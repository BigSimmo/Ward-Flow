import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { TRANSPORT_PROVIDERS, type Movement, type Referral } from "@/components/ward-management/ward-model";
import { observationAt, type Observation } from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Engine audit fixes (synthetic seed only): observation-level roles (items 1 and 2), the pull
 * carrying observation history (item 5), and BOOK_TRANSPORT's community and ward booker checks
 * (items 8 and 9).
 */
const NOW = NOW_ANCHOR;

function seed(): WardFlowState {
  return { ...seedWardFlowState(), rejections: [] };
}

function movementWhere(state: WardFlowState, test: (m: Movement) => boolean): Movement {
  const movement = state.movements.find(test);
  expect(movement, "the seed must hold this kind of movement").toBeDefined();
  return movement!;
}

/** An open, accepted movement with no bed held yet (ED start). */
const acceptedNoBed = (state: WardFlowState) =>
  movementWhere(
    state,
    (m) => !m.closure && !!m.acceptedUnitId && !m.admissionId && m.stage === "accepted_awaiting_bed",
  );

/** An open movement holding a pulled bed (ED start). */
const pulled = (state: WardFlowState) =>
  movementWhere(state, (m) => !m.closure && m.stage === "pulled" && !!m.admissionId && !!m.acceptedUnitId);

const nextLevel = (current: Observation): Observation =>
  observationAt(current.level === "within_sight" ? "two_staff" : "within_sight");

function observe(
  state: WardFlowState,
  role: "ed" | "ward" | "coordinator",
  target:
    | { kind: "movement"; movementId: string; actingUnitId?: string }
    | { kind: "admission"; admissionId: string; actingUnitId: string },
  observation: Observation,
) {
  return wardFlowReducer(state, { type: "RECORD_OBSERVATION_LEVEL", role, now: NOW + 5, target, observation });
}

describe("RECORD_OBSERVATION_LEVEL roles (items 1 and 2)", () => {
  it("refuses a ward on a movement unless it names itself as the accepted ward", () => {
    const state = seed();
    const movement = acceptedNoBed(state);
    const level = nextLevel(movement.observation);

    const unnamed = observe(state, "ward", { kind: "movement", movementId: movement.id }, level);
    expect(unnamed.rejections.at(-1)?.reason).toContain("record the level on the admission instead");
    expect(unnamed.movements.find((m) => m.id === movement.id)).toEqual(movement);

    const otherUnit = state.units.find((unit) => unit.id !== movement.acceptedUnitId)!.id;
    const other = observe(state, "ward", { kind: "movement", movementId: movement.id, actingUnitId: otherUnit }, level);
    expect(other.rejections.at(-1)?.reason).toContain("is not accepted by that ward");

    const own = observe(
      state,
      "ward",
      { kind: "movement", movementId: movement.id, actingUnitId: movement.acceptedUnitId },
      level,
    );
    expect(own.rejections).toEqual([]);
    expect(own.movements.find((m) => m.id === movement.id)?.observation).toEqual(level);
  });

  it("keeps the ED and coordinator able to change a movement's level", () => {
    const state = seed();
    const movement = acceptedNoBed(state);
    for (const role of ["ed", "coordinator"] as const) {
      const after = observe(
        state,
        role,
        { kind: "movement", movementId: movement.id },
        nextLevel(movement.observation),
      );
      expect(after.rejections).toEqual([]);
    }
  });

  it("refuses the ED on an admission target, even naming the admission's own unit", () => {
    const state = seed();
    const movement = pulled(state);
    const admission = state.admissions.find((a) => a.id === movement.admissionId)!;
    const target = { kind: "admission" as const, admissionId: admission.id, actingUnitId: admission.unitId };
    const level = nextLevel(admission.observation);

    const ed = observe(state, "ed", target, level);
    expect(ed.rejections.at(-1)?.reason).toContain("cannot be raised by role ed");
    expect(ed.admissions.find((a) => a.id === admission.id)).toEqual(admission);

    for (const role of ["ward", "coordinator"] as const) {
      expect(observe(state, role, target, level).rejections).toEqual([]);
    }
  });
});

describe("PULL_PATIENT carries observation history (item 5)", () => {
  it("copies observationChanges, so the admission's first change still needs the editing token", () => {
    const base = seed();
    const movement = acceptedNoBed(base);
    const history = [{ at: NOW - 30, from: observationAt("intermittent"), to: movement.observation }];
    const state: WardFlowState = {
      ...base,
      movements: base.movements.map((m) => (m.id === movement.id ? { ...m, observationChanges: history } : m)),
    };
    const after = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: movement.id,
      unitId: movement.acceptedUnitId!,
    });
    expect(after.rejections).toEqual([]);
    const admissionId = after.movements.find((m) => m.id === movement.id)!.admissionId!;
    const admission = after.admissions.find((a) => a.id === admissionId)!;
    expect(admission.observationChanges).toEqual(history);

    const untokened = observe(
      after,
      "ward",
      { kind: "admission", admissionId, actingUnitId: admission.unitId },
      nextLevel(admission.observation),
    );
    expect(untokened.rejections.at(-1)?.reason).toBe("Observation changed. Reopen it.");
  });

  it("leaves observationChanges absent when the movement had none", () => {
    const state = seed();
    const movement = acceptedNoBed(state);
    expect(movement.observationChanges).toBeUndefined();
    const after = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: movement.id,
      unitId: movement.acceptedUnitId!,
    });
    const admissionId = after.movements.find((m) => m.id === movement.id)!.admissionId!;
    expect(after.admissions.find((a) => a.id === admissionId)).not.toHaveProperty("observationChanges");
  });
});

function book(state: WardFlowState, movementId: string, overrides: Record<string, unknown>) {
  return wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: NOW,
    movementId,
    provider: TRANSPORT_PROVIDERS[0],
    escortRequired: true,
    cadNumber: "CAD-2026-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: NOW + 30,
    ...overrides,
  } as never);
}

/** A synthetic community-sent journey: the pulled movement re-pointed at a referral from team 0. */
function communityJourney(): { state: WardFlowState; movementId: string } {
  const base = seed();
  const movement = pulled(base);
  const team = COMMUNITY_TEAM_PAGES[0]!;
  const referral = {
    ...(base.referrals[0] ?? {}),
    id: "REF-SYNTH-COMMUNITY",
    source: "community",
    sendingTeamName: team.name,
  } as unknown as Referral;
  return {
    movementId: movement.id,
    state: {
      ...base,
      referrals: [...base.referrals, referral],
      movements: base.movements.map((m) =>
        m.id === movement.id
          ? {
              ...m,
              referralId: referral.id,
              originEdId: undefined,
              originCommunity: { teamName: team.name, siteCode: "RPH" },
            }
          : m,
      ),
    },
  };
}

describe("BOOK_TRANSPORT booker checks (items 8 and 9)", () => {
  it("refuses a community team that did not send the journey", () => {
    const { state, movementId } = communityJourney();
    const otherTeam = COMMUNITY_TEAM_PAGES[1]!.id;
    const after = book(state, movementId, { role: "community", actingPlaceId: otherTeam });
    expect(after.rejections.at(-1)?.reason).toContain("is not the referral origin team");
    expect(after.movements.find((m) => m.id === movementId)?.transport).toBeUndefined();
  });

  it("accepts the community team that sent the journey", () => {
    const { state, movementId } = communityJourney();
    const after = book(state, movementId, { role: "community", actingPlaceId: COMMUNITY_TEAM_PAGES[0]!.id });
    expect(after.rejections).toEqual([]);
  });

  it("refuses a community team on a journey with no sending team recorded", () => {
    const state = seed();
    const movement = pulled(state);
    const after = book(state, movement.id, { role: "community", actingPlaceId: COMMUNITY_TEAM_PAGES[0]!.id });
    expect(after.rejections.at(-1)?.reason).toContain("is not the referral origin team");
  });

  it("refuses every ward, not only the destination, when the journey did not start on a ward", () => {
    const state = seed();
    const movement = pulled(state);
    const otherUnit = state.units.find((unit) => unit.id !== movement.acceptedUnitId)!.id;
    for (const actingUnitId of [otherUnit, movement.acceptedUnitId!]) {
      const after = book(state, movement.id, { role: "ward", actingUnitId });
      expect(after.rejections.at(-1)?.reason).toContain("this patient did not start on a ward");
      expect(after.movements.find((m) => m.id === movement.id)?.transport).toBeUndefined();
    }
  });

  it("still lets the origin ED book", () => {
    const state = seed();
    expect(book(state, pulled(state).id, { role: "ed" }).rejections).toEqual([]);
  });
});
