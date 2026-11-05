import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  ALL_EVENT_TYPES,
  KNOWN_DUE_AT_VALUES,
  MOVEMENT_TARGETED_EVENTS,
  SWEEP_CODES,
  applyFirstAccepted,
  candidateEvents,
  iterateCandidateEvents,
  targetMovementId,
} from "./helpers/ward-legal-figure-sweep";

const profile = vi.hoisted(() => ({ counters: {} as Record<string, number> }));
vi.mock("../scripts/ward-flow/test-preparation-profile.mjs", () => ({
  createPreparationProfile: () => ({
    count: (name: string, amount = 1) => {
      profile.counters[name] = (profile.counters[name] ?? 0) + amount;
    },
    measure: <T>(_name: string, operation: () => T) => operation(),
    write: () => null,
  }),
}));

beforeEach(() => {
  profile.counters = {};
});

describe("legal sweep restricted candidate expansion", () => {
  it("does not construct arrival-check events for movements of other form codes", () => {
    const state = seedWardFlowState();
    const code = state.movements.find((movement) => movement.legalForm)?.legalForm?.code;
    expect(code).toBeDefined();
    const candidates = [...iterateCandidateEvents("RECORD_ARRIVAL_CHECK", state, NOW_ANCHOR, code)];
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(state.movements.length * 2);
    expect(profile.counters.eagerCandidatesConstructed).toBe(candidates.length);
  });

  it.each([false, true])(
    "preserves every eager candidate and its order across both seeded worlds (%s)",
    (supplyDueAt) => {
      for (const scenario of ["standard", "scarce"] as const) {
        const state = seedWardFlowState(scenario);
        for (const type of ALL_EVENT_TYPES) {
          const eager = candidateEvents(type, state, NOW_ANCHOR, supplyDueAt);
          for (const code of [undefined, "absent-form", ...SWEEP_CODES]) {
            const expected = eager.filter((event) => {
              if (code !== undefined && MOVEMENT_TARGETED_EVENTS.has(type)) {
                const id = targetMovementId(event);
                if (
                  id === undefined ||
                  state.movements.find((movement) => movement.id === id)?.legalForm?.code !== code
                )
                  return false;
              }
              return code === undefined || event.type !== "RAISE_REFERRAL" || event.draft.legalFormCode === code;
            });
            expect(
              [...iterateCandidateEvents(type, state, NOW_ANCHOR, code, supplyDueAt)],
              `${scenario}/${type}/${code}`,
            ).toEqual(expected);
          }
        }
      }
    },
  );

  it("keeps expiry sentinels registered even when no movement matches the requested form", () => {
    const now = NOW_ANCHOR + 123_457;
    const sentinel = now + 800_000;
    expect(KNOWN_DUE_AT_VALUES.has(sentinel)).toBe(false);
    expect([
      ...iterateCandidateEvents("RECORD_LEGAL_FORM_EXPIRY", seedWardFlowState(), now, "absent-form", true),
    ]).toEqual([]);
    expect(KNOWN_DUE_AT_VALUES.has(sentinel)).toBe(true);
  });

  it("retains first-id matching for duplicates and observes changed forms on subsequent calls", () => {
    const seed = seedWardFlowState();
    const carrier = seed.movements.find((movement) => movement.legalForm)!;
    const first: (typeof seed.movements)[number] = { ...carrier, legalForm: undefined };
    const state = { ...seed, movements: [first, carrier] };
    expect([...iterateCandidateEvents("RECORD_ARRIVAL_CHECK", state, NOW_ANCHOR, carrier.legalForm!.code)]).toEqual([]);
    first.legalForm = carrier.legalForm;
    expect([
      ...iterateCandidateEvents("RECORD_ARRIVAL_CHECK", state, NOW_ANCHOR, carrier.legalForm!.code),
    ]).toHaveLength(4);
  });

  it("preserves the first accepted event and reducer result for restricted movement-id candidates", () => {
    const state = seedWardFlowState();
    const code = state.movements.find((movement) => movement.legalForm)?.legalForm?.code;
    const types: WardFlowEvent["type"][] = ["RECORD_ARRIVAL_CHECK", "RECORD_MOVEMENT_GENDER", "CHANGE_URGENCY"];
    let accepted = 0;
    for (const type of types) {
      const expected = candidateEvents(type, state, NOW_ANCHOR)
        .filter(
          (event) =>
            state.movements.find((movement) => movement.id === targetMovementId(event))?.legalForm?.code === code,
        )
        .map((event) => ({ event, applied: wardFlowReducer(state, event) }))
        .find(({ applied }) => applied.rejections.length === state.rejections.length);
      if (expected) accepted += 1;
      expect(applyFirstAccepted(type, state, NOW_ANCHOR, code)).toEqual(expected);
    }
    expect(accepted).toBeGreaterThan(0);
  });
});
