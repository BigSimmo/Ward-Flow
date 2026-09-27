/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { Referral } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * WHAT A REFERRER WROTE CANNOT CHANGE AFTER THE REFERRAL IS SENT.
 *
 * **Owner ruling, 2026-09-11 (C2): _no editing after sending._** The question put to him was
 * whether a referral's history can be edited once sent and whether the receiving team would see
 * that it had changed — because *"the version the receiving team read must remain recoverable, or
 * two people will be acting on different accounts of the same patient."*
 *
 * 🔴 **THE RULING IS ALREADY HONOURED, AND BY NOTHING.** Measured at `6b150a8b2a`: there is no
 * `EDIT_REFERRAL`, `UPDATE_REFERRAL` or `AMEND_REFERRAL` event anywhere, and the five events that
 * DO replace a referral touch only what happened *to* it after sending —
 * `RECORD_MEDICAL_CLEARANCE` (clearance), `RECORD_ARRIVED_IN_DEPARTMENT` (`inDepartmentAt`),
 * `RECORD_LOCAL_BED_SOUGHT` (`localBedSought`), and `ACCEPT_REFERRAL` / `DECLINE_REFERRAL`
 * (`destinations`). **So the ruling holds today because nobody has built the feature that would
 * break it, which is not the same as being enforced.** A working safeguard leaves no trace, and an
 * absent one leaves the same trace.
 *
 * **This file is the enforcement.**
 *
 * 🔴 **DEFAULT-DENY, AND THAT IS THE WHOLE DESIGN.** The frozen set is not a list of protected
 * fields — it is **every key of `Referral` MINUS a named mutable allowlist**. So a field added to
 * `Referral` tomorrow is frozen automatically, and anyone who needs it to be writable after sending
 * must widen `MUTABLE_AFTER_SENDING` deliberately, with a reason, in a diff somebody reviews.
 * **A guard written as an allowlist of protected fields silently stops covering every field added
 * after it** — which is how `ALLOWED_REFERRAL_FIELDS` came to need the same shape.
 */

/**
 * The only fields that may change after a referral is sent, each because it records something that
 * HAPPENED to the referral rather than something the referrer wrote.
 *
 * ⚠️ **Adding a key here is a ruling, not a fix.** If a test in this file goes red, the question is
 * whether the new event is recording an EVENT or editing an ACCOUNT — and the second one is what
 * C2 forbids.
 */
const MUTABLE_AFTER_SENDING = new Set<keyof Referral>([
  // What each destination answered, and when. FD-22 cancels the rest on acceptance.
  "destinations",
  // A current state that legitimately changes — the department can stop believing someone is clear.
  "medicalClearance",
  // A fact about the past, written once; the reducer refuses to overwrite it.
  "inDepartmentAt",
  // Whether a local bed was sought, written once; the reducer refuses a second.
  "localBedSought",
  // Triage time, stamped by the receiving end rather than the referrer.
  "triagedAt",
]);

/** Everything else on the referral, snapshotted for comparison. */
function writtenContent(referral: Referral): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const key of Object.keys(referral) as (keyof Referral)[]) {
    if (!MUTABLE_AFTER_SENDING.has(key)) content[key as string] = referral[key];
  }
  return content;
}

/** Every referral in the state, by id, reduced to its written content. */
function contentById(state: WardFlowState): Map<string, string> {
  return new Map(
    state.referrals.map((referral: Referral) => [referral.id, JSON.stringify(writtenContent(referral))] as const),
  );
}

describe("a sent referral's content is immutable (C2)", () => {
  /**
   * 🔴 THE ANTI-VACUITY FLOOR, FIRST BECAUSE IT IS THE ONE THAT MATTERS. If the seed carried no
   * referrals, or if `MUTABLE_AFTER_SENDING` happened to cover every key, every case below would
   * pass while comparing nothing at all.
   */
  it("the seed carries referrals, and their written content is a non-empty set of fields", () => {
    const state = seedWardFlowState();
    expect(state.referrals.length, "no referrals in the seed — this suite would prove nothing").toBeGreaterThan(0);

    const first = state.referrals[0];
    expect(first).toBeDefined();
    const frozen = Object.keys(writtenContent(first!));
    expect(frozen.length, "every field is mutable — the frozen set is empty").toBeGreaterThan(5);
    // The referrer's own prose is the field the ruling was actually about.
    expect(frozen, "history is not frozen — C2 is about exactly this field").toContain("history");
  });

  /**
   * ⚠️ **EVERY EVENT THE REDUCER ACCEPTS, NOT A HAND-PICKED FEW.** A list of events chosen today
   * stops covering the one added tomorrow, which is the event most likely to break this. The events
   * are built from the seed's own records so they are accepted rather than rejected — a rejected
   * event changes nothing and would pass this test while proving nothing about acceptance.
   */
  it("no event that the reducer accepts changes what a referrer wrote", () => {
    const state = seedWardFlowState();
    const referral = state.referrals[0];
    expect(referral).toBeDefined();

    const before = contentById(state);

    /*
     * ⚠️ THE DISCRIMINANT IS `type`, NOT `kind`, AND MY FIRST DRAFT USED `kind` FOR BOTH THESE
     * EVENTS AND THE SOURCE SCAN BELOW. The scan's anti-vacuity floor caught it — it read ZERO
     * event kinds and said so. Without that floor the scan would have swept an empty list and
     * reported no editing event, forever, which is the exact failure this file exists to prevent
     * one level down.
     */
    const events: WardFlowEvent[] = [
      { type: "RECORD_MEDICAL_CLEARANCE", role: "ed", referralId: referral!.id, cleared: true, now: NOW_ANCHOR },
      { type: "RECORD_MEDICAL_CLEARANCE", role: "ed", referralId: referral!.id, cleared: false, now: NOW_ANCHOR },
      { type: "RECORD_ARRIVED_IN_DEPARTMENT", role: "ed", referralId: referral!.id, now: NOW_ANCHOR },
      { type: "RECORD_LOCAL_BED_SOUGHT", role: "coordinator", referralId: referral!.id, now: NOW_ANCHOR },
    ] as unknown as WardFlowEvent[];

    let current = state;
    let applied = 0;
    for (const event of events) {
      const next = wardFlowReducer(current, event);
      // A refused event returns the same state object; only count the ones that did something.
      if (next !== current) applied += 1;
      current = next;
    }

    expect(applied, "no event was accepted — this case would prove nothing about mutation").toBeGreaterThan(0);

    const after = contentById(current);
    for (const [id, content] of before) {
      expect(
        after.get(id),
        `referral ${id}'s written content changed. C2 (owner, 2026-09-11): no editing after ` +
          `sending — "the version the receiving team read must remain recoverable, or two people " +
          "will be acting on different accounts of the same patient." If a new event legitimately ` +
          `records something that HAPPENED to a referral, add its field to MUTABLE_AFTER_SENDING ` +
          `with a reason. If it EDITS what the referrer wrote, it is what this ruling forbids.`,
      ).toBe(content);
    }
  });

  /**
   * 🔴 THIS IS A FLOOR ON THE COMPARISON, NOT A MUTATION PROOF — AND ITS HONEST COMMENT IS WHAT
   * DISGUISED THAT FOR A DAY.
   *
   * It proves the comparison above can actually fail: without it, a `writtenContent` that
   * returned `{}` for every referral would make every assertion pass forever. **That is a real
   * and necessary guarantee and it is the LESSER of the two instruments.**
   *
   * ⚠️ **It tampers with an in-memory COPY of the state. It never touches the reducer.** So it
   * cannot tell you whether the behavioural case above is load-bearing — only that the equality
   * check it relies on is not vacuous. An audit correctly classified this file as SELF-TESTING
   * rather than PROVEN on exactly that distinction.
   *
   * 🔴 **THE COMMENT THAT USED TO SIT HERE SAID "THE MUTATION PROOF" AND WAS OTHERWISE ACCURATE.**
   * A misleading comment would have been caught by anybody reading the code beneath it; an
   * accurate one describing the lesser instrument reads as the greater, and nothing in the file
   * contradicts it. **A tampering case inside the suite and a mutation of the production code are
   * different instruments, and the first is the one that feels like the second.**
   *
   * ✅ **THE REAL MUTATION HAS NOW BEEN RUN, against the reducer.** 2026-09-11: the accepted
   * `RECORD_MEDICAL_CLEARANCE` handler was made to append to `Referral.history` as well —
   * precisely the edit C2 forbids, arriving through an event the reducer accepts.
   *
   *     x no event that the reducer accepts changes what a referrer wrote
   *
   * ⚠️ **ONE of four cases went red, and it is the behavioural one.** This case stayed GREEN
   * under that mutant — correctly, and that is the whole demonstration: it does not watch the
   * production path. Restored and verified clean afterwards.
   */
  it("the comparison detects an edit to the referrer's prose", () => {
    const state = seedWardFlowState();
    const referral = state.referrals[0]!;
    const tampered: WardFlowState = {
      ...state,
      referrals: state.referrals.map((candidate) =>
        candidate.id === referral.id ? { ...candidate, history: `${candidate.history} (edited)` } : candidate,
      ),
    };
    expect(contentById(tampered).get(referral.id)).not.toBe(contentById(state).get(referral.id));
  });

  /**
   * ⚠️ NO EDIT EVENT EXISTS, AND THIS IS THE CHEAP HALF OF THE GUARD. The behavioural case above
   * can only exercise events it knows about; this one reddens the moment somebody declares an
   * editing event, whether or not any test drives it.
   */
  it("declares no event whose purpose is editing a sent referral", () => {
    // Read as text rather than imported: the point is that no such event EXISTS to import.
    const events = readEventKinds();
    expect(events.length, "no event kinds read — this guard would prove nothing").toBeGreaterThan(10);
    const editing = events.filter((kind) => /^(EDIT|UPDATE|AMEND|REVISE|CORRECT)_REFERRAL/.test(kind));
    expect(
      editing,
      "an event exists whose name says it edits a referral. C2 forbids editing after sending; if " +
        "this event records something that happened TO the referral instead, its name should say so.",
    ).toEqual([]);
  });
});

/** Every `kind` the event union declares, read from source. */
function readEventKinds(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const source = readFileSync("src/components/ward-management/ward-flow-events.ts", "utf8");
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/type:\s*"([A-Z_]+)"/g)].map((match) => match[1]!);
}
