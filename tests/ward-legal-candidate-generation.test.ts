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
