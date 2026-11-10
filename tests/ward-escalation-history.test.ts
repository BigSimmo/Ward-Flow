import { describe, expect, it } from "vitest";

import {
  escalationHistory,
  escalationNextLabel,
  escalationRecords,
  escalationSentence,
} from "@/components/ward-management/movements/escalation-history";
import { scopeWorkspace } from "@/components/ward-management/ward-access-scope";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { storedStateRestoreProblem } from "@/components/ward-management/ward-flow-storage-validation";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Item 28 (Josh, 9 Nov 2026, care plans and safety flags thread: defaults approved): every
 * escalation is kept, oldest first, and what happened next is derived from the movement's own
 * records. D9-2: recording one still records it and nothing else.
 */
function movement(overrides: Partial<Movement>): Movement {
  return { id: "ZZ-SYNTH-1", openedAt: 0, ...overrides } as Movement;
}

describe("escalation history", () => {
  it("appends each escalation and keeps the latest on `escalation` for existing readers", () => {
    const before = seedWardFlowState();
    const target = before.movements.find((candidate) => !candidate.closure && !candidate.escalation)!;
    const raise = (state: typeof before, now: number, contact: string) =>
      wardFlowReducer(state, {
        type: "RECORD_ESCALATION",
        role: "coordinator",
        now,
        movementId: target.id,
        triedUnitIds: [before.units[0]!.id],
        contact,
      });
    const after = raise(raise(before, NOW_ANCHOR, "Site bed manager"), NOW_ANCHOR + 5, "State bed desk");
    expect(after.rejections, after.rejections.at(-1)?.reason).toEqual([]);
    const saved = after.movements.find((candidate) => candidate.id === target.id)!;
    expect(saved.escalation).toEqual({
      at: NOW_ANCHOR + 5,
      triedUnitIds: [before.units[0]!.id],
      contact: "State bed desk",
    });
    expect(saved.escalations?.map((entry) => [entry.at, entry.by, entry.contact])).toEqual([
      [NOW_ANCHOR, "coordinator", "Site bed manager"],
      [NOW_ANCHOR + 5, "coordinator", "State bed desk"],
    ]);
  });

  it("starts the list from an older save's one escalation, with no role invented for it", () => {
    const before = seedWardFlowState();
    const target = before.movements.find((candidate) => !candidate.closure && !candidate.escalation)!;
    const legacy = { ...target, escalation: { at: NOW_ANCHOR - 10, triedUnitIds: [], contact: "Old desk" } };
    delete (legacy as Partial<Movement>).escalations;
    const state = { ...before, movements: before.movements.map((m) => (m.id === target.id ? legacy : m)) };
    const after = wardFlowReducer(state, {
      type: "RECORD_ESCALATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: target.id,
      triedUnitIds: [],
      contact: "New desk",
    });
    const saved = after.movements.find((candidate) => candidate.id === target.id)!;
    expect(saved.escalations?.map((entry) => [entry.contact, entry.by])).toEqual([
      ["Old desk", undefined],
      ["New desk", "coordinator"],
    ]);
    expect(escalationSentence(saved.escalations![0]!)).toBe("Escalated to Old desk");
    expect(escalationSentence(saved.escalations![1]!)).toBe("Bed coordinator escalated to New desk");
  });

  it("reads an older save with only `escalation` as a one-entry history", () => {
    const legacy = movement({ escalation: { at: 5, triedUnitIds: ["u1"], contact: "Desk" } });
    expect(escalationRecords(legacy)).toEqual([{ at: 5, triedUnitIds: ["u1"], contact: "Desk" }]);
    expect(escalationRecords(movement({}))).toEqual([]);
  });

  it("derives what happened next: escalated again, then accepted", () => {
    const history = escalationHistory(
      movement({
        escalations: [
          { at: 10, by: "coordinator", triedUnitIds: [], contact: "A" },
          { at: 20, by: "coordinator", triedUnitIds: [], contact: "B" },
        ],
        acceptedAt: 30,
        acceptedUnitId: "u1",
      }),
    );
    expect(history.map((entry) => entry.next)).toEqual([
      { kind: "escalated_again", at: 20 },
      { kind: "accepted", at: 30, unitId: "u1" },
    ]);
    expect(
      escalationNextLabel(
        history[1]!.next,
        () => "Ward One",
        (at) => `t${at}`,
      ),
    ).toBe("Accepted by Ward One, t30");
  });

  it("derives a withdrawal and an unanswered escalation", () => {
    const withdrawn = escalationHistory(
      movement({
        escalations: [{ at: 10, by: "coordinator", triedUnitIds: [], contact: "A" }],
        closure: { at: 15, outcome: "did_not_proceed", reason: "referral_withdrawn" },
      }),
    );
    expect(withdrawn[0]!.next).toEqual({ kind: "did_not_proceed", at: 15 });
    const open = escalationHistory(
      movement({ escalations: [{ at: 10, by: "coordinator", triedUnitIds: [], contact: "A" }] }),
    );
    expect(escalationNextLabel(open[0]!.next, String, String)).toBe("No answer recorded yet");
  });

  it("counts an acceptance by a ward outside the desk's view", () => {
    const history = escalationHistory(
      movement({ escalations: [{ at: 10, by: "coordinator", triedUnitIds: [], contact: "A" }], acceptedAt: 12 }),
    );
    expect(history[0]!.next).toEqual({ kind: "accepted", at: 12 });
    expect(escalationNextLabel(history[0]!.next, String, (at) => `t${at}`)).toBe(
      "Accepted by a ward outside your view, t12",
    );
  });

  it("accepts the saved shape of movements with and without `escalations`", () => {
    const seeded = seedWardFlowState();
    const withHistory = JSON.parse(JSON.stringify(seeded));
    const withoutHistory = JSON.parse(JSON.stringify(seeded));
    for (const saved of withoutHistory.movements) delete saved.escalations;
    expect(withHistory.movements.some((saved: Movement) => (saved.escalations?.length ?? 0) > 1)).toBe(true);
    expect(storedStateRestoreProblem(withHistory)).toBeUndefined();
    expect(storedStateRestoreProblem(withoutHistory)).toBeUndefined();
  });

  it("a receiving ward sees only its own wards in each escalation's wards tried", () => {
    const seeded = seedWardFlowState();
    const escalated = seeded.movements.find((candidate) => (candidate.escalations?.length ?? 0) > 1)!;
    const own = escalated.escalations![0]!.triedUnitIds[0]!;
    const source = {
      ...seeded,
      movements: [{ ...escalated, referredUnitIds: [own], referralId: undefined, sourceAdmissionId: undefined }],
    };
    const access: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [own] } };
    const scoped = scopeWorkspace(source, access, { now: NOW_ANCHOR, places: wardPlaceLookup(seeded.units) });
    const seen = scoped.movements.find((candidate) => candidate.id === escalated.id)!;
    expect(seen).toBeDefined();
    expect(seen.escalations?.map((entry) => entry.triedUnitIds)).toEqual([[own], [own]]);
    expect(seen.escalation?.triedUnitIds).toEqual([own]);
  });
});
