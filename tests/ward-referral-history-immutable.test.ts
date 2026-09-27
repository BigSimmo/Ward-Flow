// tests/ward-referral-history-immutable.test.ts
//
// RB7 — correction notes (build plan item 27, docs/ward-flow/plans/2026-09-17-build-plan-referrals-transport.md).
// `ADD_REFERRAL_CORRECTION` appends a new, attributed, timestamped note to `Referral.corrections`
// and must NEVER rewrite `Referral.history` — the referral's own point-in-time written account
// (`ward-model.ts`'s own doc comment on `history`: "STORED BYTE FOR BYTE... nothing may ever be
// derived from it"). This file proves both halves: the reducer behaviour, and — because a reducer
// case that quietly started writing `history:` would still pass every behavioural assertion below
// as long as it ALSO wrote `corrections` correctly — a static scan of the reducer's own source that
// `ADD_REFERRAL_CORRECTION`'s case body never assigns `history:` at all.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS, type Referral } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function anyReferral(state: ReturnType<typeof seedWardFlowState>): Referral {
  const found = state.referrals[0];
  if (!found) throw new Error("the seed contains no referral");
  return found;
}

describe("ADD_REFERRAL_CORRECTION — RB7, build plan item 27 (2026-09-17)", () => {
  it("appends a note carrying the acting role and the time, and leaves history unchanged", () => {
    const state = seedWardFlowState();
    const referral = anyReferral(state);
    const historyBefore = referral.history;

    const next = wardFlowReducer(state, {
      type: "ADD_REFERRAL_CORRECTION",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      note: "The escort arrived at 14:05, not 14:00 as first written.",
    });

    expect(next.rejections, `refused: ${next.rejections.at(-1)?.reason}`).toHaveLength(0);
    const updated = next.referrals.find((candidate) => candidate.id === referral.id)!;
    expect(updated.corrections).toEqual([
      { at: NOW, by: "coordinator", note: "The escort arrived at 14:05, not 14:00 as first written." },
    ]);
    // History is unchanged — byte for byte, the same referral it was before the correction.
    expect(updated.history).toBe(historyBefore);
  });

  it("appends a second correction on top of the first, dropping neither", () => {
    const state = seedWardFlowState();
    const referral = anyReferral(state);

    const once = wardFlowReducer(state, {
      type: "ADD_REFERRAL_CORRECTION",
      role: "ed",
      now: NOW,
      referralId: referral.id,
      note: "First correction.",
    });
    expect(once.rejections).toHaveLength(0);

    const twice = wardFlowReducer(once, {
      type: "ADD_REFERRAL_CORRECTION",
      role: "community",
      now: NOW + 30,
      referralId: referral.id,
      note: "Second correction, from a different party.",
    });
    expect(twice.rejections).toHaveLength(0);

    const updated = twice.referrals.find((candidate) => candidate.id === referral.id)!;
    expect(updated.corrections).toEqual([
      { at: NOW, by: "ed", note: "First correction." },
      { at: NOW + 30, by: "community", note: "Second correction, from a different party." },
    ]);
  });

  it("refuses a blank note", () => {
    const state = seedWardFlowState();
    const referral = anyReferral(state);
    const before = state.rejections.length;

    const next = wardFlowReducer(state, {
      type: "ADD_REFERRAL_CORRECTION",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      note: "   ",
    });

    expect(next.rejections.length).toBeGreaterThan(before);
    expect(next.rejections.at(-1)?.reason).toMatch(/blank/i);
    expect(next.referrals.find((candidate) => candidate.id === referral.id)!.corrections).toBeUndefined();
  });

  it(`refuses a note over ${REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS} characters, and never shortens it`, () => {
    const state = seedWardFlowState();
    const referral = anyReferral(state);
    const before = state.rejections.length;
    const overLong = "x".repeat(REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS + 1);

    const next = wardFlowReducer(state, {
      type: "ADD_REFERRAL_CORRECTION",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      note: overLong,
    });

    expect(next.rejections.length).toBeGreaterThan(before);
    expect(next.rejections.at(-1)?.reason).toMatch(/REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS|limit is/i);
    expect(next.referrals.find((candidate) => candidate.id === referral.id)!.corrections).toBeUndefined();

    // Positive control — exactly at the limit is accepted whole, never shortened.
    const atLimit = "y".repeat(REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS);
    const accepted = wardFlowReducer(state, {
      type: "ADD_REFERRAL_CORRECTION",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      note: atLimit,
    });
    expect(accepted.rejections, `refused: ${accepted.rejections.at(-1)?.reason}`).toHaveLength(0);
    const updated = accepted.referrals.find((candidate) => candidate.id === referral.id)!;
    expect(updated.corrections?.[0]?.note).toHaveLength(REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS);
  });

  it("refuses an unknown referral", () => {
    const state = seedWardFlowState();
    const next = wardFlowReducer(state, {
      type: "ADD_REFERRAL_CORRECTION",
      role: "coordinator",
      now: NOW,
      referralId: "REF-NOT-A-REAL-ONE",
      note: "This should never land.",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toMatch(/no referral found/i);
    // `subjectId` (`ward-flow-reducer.ts`) must name this event as referral-scoped, the same as
    // `RECORD_REFERRER_WITHDRAWAL` — an event carrying no `movementId` falling through to the
    // `default` branch there reads `event.movementId` off a payload that has no such field, which
    // is a `tsc` error this test cannot itself catch but this assertion is evidence the case is
    // actually wired, not merely that `tsc` once passed.
    expect(next.rejections[0]?.movementId).toBe("REF-NOT-A-REAL-ONE");
    expect(next.referrals).toEqual(state.referrals);
  });

  describe("static scan — ADD_REFERRAL_CORRECTION never authors fresh Referral.history", () => {
    /**
     * Reads the reducer's own source rather than trusting a convention followed by eye — the same
     * "the guard catches the WRITE, not the DECLARATION" discipline `ward-referral-model.test.ts`'s
     * privacy guard already states for its own field-based checks, applied here to ONE case body
     * instead of the whole file: a reducer case that quietly started assigning `history:` inside
     * `case "ADD_REFERRAL_CORRECTION"` would pass every behavioural test above (as long as it also
     * wrote `corrections` correctly) and this is the only thing that would catch it.
     *
     * Scoped to this one case body, not the whole reducer: `case "REFER_TO_COMMUNITY_TEAM"`
     * (`ward-flow-reducer.ts`) already writes `history: linkedReferral?.history ?? ""` when it
     * raises a NEW referral record from an ED movement — a documented, deliberate CARRY-FORWARD of
     * an existing referral's own already-written account, not a fresh authoring of one, and a
     * whole-file "only RECEIVE_REFERRAL ever writes history:" claim would be false today for a
     * reason unrelated to this task. What RB7 actually guards against is `ADD_REFERRAL_CORRECTION`
     * specifically becoming a second way to overwrite an EXISTING referral's own `history`.
     */
    it("the ADD_REFERRAL_CORRECTION case body contains no history: assignment", () => {
      const source = readFileSync("src/components/ward-management/ward-flow-reducer.ts", "utf8");
      const caseStart = source.indexOf('case "ADD_REFERRAL_CORRECTION": {');
      expect(caseStart, "ADD_REFERRAL_CORRECTION case body not found in the reducer").toBeGreaterThan(-1);

      const afterCase = source.slice(caseStart);
      const nextCaseIndex = afterCase.indexOf("\n    case ", 1);
      expect(nextCaseIndex, "could not find the end of the ADD_REFERRAL_CORRECTION case body").toBeGreaterThan(-1);
      const caseBody = afterCase.slice(0, nextCaseIndex);

      expect(caseBody, "ADD_REFERRAL_CORRECTION must never assign Referral.history").not.toMatch(/\bhistory\s*:/);
      // Sanity check on the scan itself: the case body DOES write `corrections:`, so an empty or
      // mis-sliced extraction cannot pass this test by finding nothing at all.
      expect(caseBody).toMatch(/\bcorrections\s*:/);
    });

    it("RECEIVE_REFERRAL is still the one place a referral's history is freshly authored from a caller's own typed text", () => {
      const source = readFileSync("src/components/ward-management/ward-flow-reducer.ts", "utf8");
      // The BODY, not merely the label: `case "RECEIVE_REFERRAL":` alone also matches a
      // fall-through case label earlier in the same switch (shared preamble validation with other
      // event types), which carries no body of its own and would truncate this scan almost
      // immediately. The brace is what marks the actual implementation.
      const caseStart = source.indexOf('case "RECEIVE_REFERRAL": {');
      expect(caseStart, "RECEIVE_REFERRAL case body not found in the reducer").toBeGreaterThan(-1);
      const afterCase = source.slice(caseStart);
      const nextCaseIndex = afterCase.indexOf("\n    case ", 1);
      expect(nextCaseIndex).toBeGreaterThan(-1);
      const caseBody = afterCase.slice(0, nextCaseIndex);
      expect(caseBody).toMatch(/history:\s*event\.history/);
    });
  });
});
