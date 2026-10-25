import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WARD_REQUEST_WITHDRAWAL_REASONS } from "@/components/ward-management/ward-change-reasons";
import { DECLINE_REASONS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  applyFirstAccepted,
  candidateEvents,
  iterateCandidateEvents,
  targetMovementId,
  MOVEMENT_TARGETED_EVENTS,
} from "./helpers/ward-legal-figure-sweep";

const pairTypes: WardFlowEvent["type"][] = [
  "FLAG_LEGAL_MISMATCH",
  "REFER_TO_UNITS",
  "ACCEPT_IN_PRINCIPLE",
  "PULL_PATIENT",
  "DECLINE",
  "WITHDRAW_WARD_REQUEST",
];

describe("legal sweep candidate generation", () => {
  it.each(pairTypes)("retains the complete legacy Cartesian array and order for %s", (type) => {
    const state = seedWardFlowState();
    const expected = state.movements.flatMap((movement) =>
      state.units.map((unit) => ({
        type,
        role: EVENT_ROLE[type][0],
        now: NOW_ANCHOR,
        movementId: movement.id,
        ...(type === "REFER_TO_UNITS" ? { unitIds: [unit.id] } : { unitId: unit.id }),
        ...(type === "FLAG_LEGAL_MISMATCH" ? { kind: "involuntary_on_voluntary_ward" } : {}),
        ...(type === "DECLINE" ? { reason: DECLINE_REASONS[0] } : {}),
        ...(type === "WITHDRAW_WARD_REQUEST" ? { reason: WARD_REQUEST_WITHDRAWAL_REASONS[0] } : {}),
      })),
    );
    expect(candidateEvents(type, state, NOW_ANCHOR)).toEqual(expected);
    expect([...iterateCandidateEvents(type, state, NOW_ANCHOR)]).toEqual(expected);
    const code = state.movements.find((movement) => movement.legalForm)?.legalForm?.code;
    expect(code).toBeDefined();
    const matching = MOVEMENT_TARGETED_EVENTS.has(type)
      ? expected.filter(
          (event) => state.movements.find((movement) => movement.id === event.movementId)?.legalForm?.code === code,
        )
      : expected;
    expect([...iterateCandidateEvents(type, state, NOW_ANCHOR, code)]).toEqual(matching);
  });

  it("stops the lazy iterator before touching later movements once the first candidate is requested", () => {
    const state = seedWardFlowState();
    let laterIdRead = false;
    const later = {
      ...state.movements[0],
      get id(): (typeof state.movements)[number]["id"] {
        laterIdRead = true;
        throw new Error("later candidate constructed");
      },
    };
    const iterator = iterateCandidateEvents(
      "REFER_TO_UNITS",
      { ...state, movements: [state.movements[0], later] },
      NOW_ANCHOR,
    );
    expect(iterator.next().value).toMatchObject({ movementId: state.movements[0].id });
    expect(laterIdRead).toBe(false);
    iterator.return(undefined);
  });

  it("filters unmatched form subjects before reading units and respects the first duplicate id", () => {
    const state = seedWardFlowState();
    const unit = {
      ...state.units[0],
      get id(): string {
        throw new Error("filtered candidate constructed");
      },
    };
    expect([
      ...iterateCandidateEvents("REFER_TO_UNITS", { ...state, units: [unit] }, NOW_ANCHOR, "absent-form"),
    ]).toEqual([]);
    const carrier = state.movements.find((movement) => movement.legalForm)!;
    const first = { ...carrier, legalForm: undefined };
    const duplicates = { ...state, movements: [first, carrier] };
    expect([...iterateCandidateEvents("REFER_TO_UNITS", duplicates, NOW_ANCHOR, carrier.legalForm!.code)]).toEqual([]);
  });

  it("retains the first accepted event and resulting state after form restriction", () => {
    const state = seedWardFlowState();
    const code = state.movements.find((movement) => movement.legalForm)?.legalForm?.code;
    for (const type of ["REFER_TO_UNITS", "ACCEPT_IN_PRINCIPLE", "DECLINE"] as const) {
      const candidates = candidateEvents(type, state, NOW_ANCHOR).filter(
        (event) =>
          state.movements.find((movement) => movement.id === targetMovementId(event))?.legalForm?.code === code,
      );
      const expected = candidates
        .map((event) => ({ event, applied: wardFlowReducer(state, event) }))
        .find((entry) => entry.applied.rejections.length === state.rejections.length);
      expect(applyFirstAccepted(type, state, NOW_ANCHOR, code)).toEqual(expected);
    }
  });

  it.each([true, false])("preserves supplied/absent deadline generation (%s)", (supplyDueAt) => {
    const state = seedWardFlowState();
    for (const type of ["RAISE_REFERRAL", "RECORD_LEGAL_FORM_EXPIRY", "RECORD_LEGAL_FORM_WRITTEN"] as const) {
      expect([...iterateCandidateEvents(type, state, NOW_ANCHOR, undefined, supplyDueAt)]).toEqual(
        candidateEvents(type, state, NOW_ANCHOR, supplyDueAt),
      );
    }
  });
});

describe("bounded accepted-referral hold candidates", () => {
  function bench() {
    const seed = seedWardFlowState();
    const unitId = "scgh-adult-open";
    let state: ReturnType<typeof seedWardFlowState> = {
      ...seed,
      admissions: [],
      movements: [],
      referrals: [],
      units: seed.units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              beds: 3,
              lockedBeds: 0,
              allocatableLocked: 0,
              allocatable: { ...u.allocatable, value: 3 },
              empty: { ...u.empty, value: 3 },
            }
          : u,
      ),
    };
    function receive() {
      state = wardFlowReducer(state, {
        type: "RECEIVE_REFERRAL",
        role: "community",
        now: NOW_ANCHOR,
        ageBand: "Adult",
        destinations: [
          {
            kind: "psychiatric_ward",
            unitId,
            sex: "Female",
            gender: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "unknown", reason: "not_known" },
        source: "community",
        urgency: 2,
        originSiteCode: "SCGH",
        transportNeeded: false,
        ...FIXTURE_HISTORY,
      });
      const referralId = state.referrals.at(-1)!.id;
      state = wardFlowReducer(state, {
        type: "ACCEPT_REFERRAL",
        role: "ward",
        actingUnitId: unitId,
        unitId,
        referralId,
        destinationKind: "psychiatric_ward",
        now: NOW_ANCHOR,
      });
      expect(state.rejections).toEqual([]);
      return referralId;
    }
    const other = receive();
    const target = receive();
    state = {
      ...state,
      admissions: [{ ...seed.admissions.find((a) => a.state === "occupied")!, unitId, bedNumber: 1 }],
      referrals: state.referrals.map((r) =>
        r.id === other ? { ...r, destinations: r.destinations.map((a) => ({ ...a, heldBedNumber: 2 })) } : r,
      ),
    };
    return { state, target, unitId, seed };
  }
  it("skips occupied and other-referral-held numbers while retaining one candidate", () => {
    const { state, target } = bench();
    const candidates = candidateEvents("HOLD_REFERRAL_BED", state, NOW_ANCHOR).filter(
      (e) => e.type === "HOLD_REFERRAL_BED" && e.referralId === target,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ bedNumber: 3 });
    expect(wardFlowReducer(state, candidates[0]!).rejections).toEqual([]);
  });
  it("keeps a bounded refusal candidate when all fitting numbers are unavailable", () => {
    const { state, target, unitId, seed } = bench();
    const full = {
      ...state,
      admissions: [
        ...state.admissions,
        { ...seed.admissions.find((a) => a.state === "occupied")!, id: "AD-LAST-NUMBER", unitId, bedNumber: 3 },
      ],
    };
    const candidates = candidateEvents("HOLD_REFERRAL_BED", full, NOW_ANCHOR).filter(
      (e) => e.type === "HOLD_REFERRAL_BED" && e.referralId === target,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ bedNumber: 1 });
    expect(wardFlowReducer(full, candidates[0]!).rejections).toHaveLength(1);
  });
});
