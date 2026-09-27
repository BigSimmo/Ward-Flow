import { describe, expect, it } from "vitest";

import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { ReferralDraft } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { legalFormGroupOf, legalFormGroupRows } from "@/components/ward-management/legal-forms/legal-forms-derivations";

/**
 * A COORDINATOR CAN NOW PUT A DEADLINE ON A TRANSPORT OR TRANSFER ORDER, AND BEFORE THIS FILE
 * NOBODY COULD.
 *
 * 🔴 **THE DEFECT THIS EXISTS TO STOP RETURNING: `LegalForm.dueAt` had ZERO writers in the
 * reducer.** Measured 2026-09-07 — `grep -c dueAt ward-flow-reducer.ts` returned **0**, against
 * controls in the same file of `stage:` 13, `legalForm` 4 and `at:` 43, so the grep was working.
 * Four deadlines existed in the whole application and **all four were authored into the seed
 * fixture** (`ward-movements.ts`: 4C `+300`, 4A `+90`, 4C `+340`, 4A `+60`).
 *
 * ⚠️ **WHAT THAT MEANT, AND WHY NO EXISTING TEST NOTICED.** A patient a coordinator raised while
 * actually using the prototype could never have a legal clock at all. Every screen handled the
 * absence impeccably — `ward-model.ts:239-255` insists an absent `dueAt` is rendered as absent and
 * never as "clear", and the console duly prints "no deadline recorded". **A careful absence is
 * indistinguishable from a careful absence that is the only reachable state**, and good handling of
 * an empty case is exactly what hides an empty case that can never be full. Every deadline-reading
 * code path — the severity ordering, the delays clock — was therefore exercised ONLY by seeded
 * patients, and a test asserting against the fixture would have passed while proving the opposite
 * of what it claimed.
 *
 * ⚠️ **SO THIS FILE RAISES THE REFERRAL THROUGH THE REDUCER AND NEVER READS A SEEDED MOVEMENT.**
 * That is the entire point of it. If a future edit makes these assertions pass by finding a
 * fixture patient, the guard has become the thing it was written to catch — the movements below are
 * located by the id this dispatch created, never by a search for "a movement with a 4A".
 *
 * **The owner's answer, 2026-09-07, to one question in one sentence:** *"when a coordinator raises a
 * transport (4A) or transfer (4C) order, should the screen ask them to type the due time?"* —
 * **"Yes"**. That is an authorisation to ASK, and this file pins both halves of it: what it
 * permits, and what it must never become.
 */

const ED_ID = allEmergencyDepartments()[0]!.id;
const NOW = 9 * 60;

function draft(overrides: Partial<ReferralDraft> = {}): ReferralDraft {
  return {
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    urgency: 2,
    legalFormCode: null,
    ...overrides,
  };
}

/** Raises one referral through the real reducer and returns the movement it created — by id, so
 *  nothing here can accidentally read a seeded patient. */
function raise(overrides: Partial<ReferralDraft>) {
  const before: WardFlowState = seedWardFlowState();
  const after = wardFlowReducer(before, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW,
    edId: ED_ID,
    draft: draft(overrides),
  });
  const created = after.movements.filter(
    (movement) => !before.movements.some((existing) => existing.id === movement.id),
  );
  return { after, created };
}

describe("a coordinator's own transport order can carry a deadline", () => {
  it("writes the due time the coordinator typed onto a 4A", () => {
    const { after, created } = raise({ legalFormCode: "4A", legalFormDueAt: NOW + 45 });

    // Anti-vacuity, in this order deliberately: a rejected event creates nothing, and an assertion
    // about `created[0]` would then throw a confusing undefined rather than say what went wrong.
    expect(after.rejections, "the referral must be accepted, or nothing below is exercised").toEqual([]);
    expect(created, "exactly one movement must have been created by this dispatch").toHaveLength(1);

    const form = created[0]!.legalForm;
    expect(form?.code, "the form the coordinator picked must survive the reducer").toBe("4A");
    expect(
      form?.dueAt,
      "a 4A raised through the reducer must carry the deadline the coordinator typed — this is the " +
        "assertion that fails if the runtime writer is ever removed and deadlines go back to being " +
        "seed-only",
    ).toBe(NOW + 45);
  });

  it("writes it onto a 4C too, so the pair is not one case and a coincidence", () => {
    const { after, created } = raise({ legalFormCode: "4C", legalFormDueAt: NOW + 200 });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0]!.legalForm?.dueAt).toBe(NOW + 200);
  });

  /**
   * ⚠️ The absence has to stay REACHABLE, not merely permitted. If the reducer ever invented a
   * fallback the screens would render a deadline nobody set, which is the fabrication
   * `ward-model.ts` spends fifteen lines forbidding.
   */
  it("leaves the deadline absent when the coordinator did not type one", () => {
    const { after, created } = raise({ legalFormCode: "4A" });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0]!.legalForm?.code, "the form itself must still be recorded").toBe("4A");
    expect(
      created[0]!.legalForm?.dueAt,
      "no due time typed must mean no deadline — never a computed one and never a default",
    ).toBeUndefined();
  });
});

describe("every selectable code keeps a typed expiry now, per owner answer 1 (2026-09-17)", () => {
  /**
   * 🔴 **CORRECTED 2026-09-17, T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`)
   * — THIS DESCRIBE BLOCK USED TO PIN THE OPPOSITE.** Until this date 1A, 3B and 3D dropped a
   * supplied due time silently, on the product owner's instruction of 2026-08-23 — *"please can
   * you leave the legal part and just start a clock once the patient arrives to ED. Keep it simple
   * for now."* That instruction forbade COMPUTING a statutory duration; it never forbade recording
   * one a human types. Owner answer 1, 2026-09-17 (`docs/ward-flow/owner-answers-2026-09-17.md`):
   * *"the timer that starts when a patient arrives is separate to forms. One records time in ED
   * and the other is a forms category."* Read with the rest of item 1, his instruction is that the
   * clinician types the expiry written on whichever form they hold — of any code — and this model
   * records exactly that. So the three cases below are DELIBERATELY REVERSED, not merely edited:
   * a due time supplied with a 1A, 3B or 3D must now survive capture exactly as one supplied with
   * a 4A or 4C always has.
   */
  for (const code of ["1A", "3B", "3D"]) {
    it(`keeps a due time typed against a Form ${code}, not only against 4A/4C`, () => {
      const { after, created } = raise({ legalFormCode: code, legalFormDueAt: NOW + 45 });
      expect(after.rejections, `a Form ${code} referral is still a valid referral`).toEqual([]);
      expect(created).toHaveLength(1);
      expect(created[0]!.legalForm?.code, "the form must still be recorded").toBe(code);
      expect(
        created[0]!.legalForm?.dueAt,
        `a Form ${code} must keep the expiry the clinician typed, exactly as 4A/4C already do`,
      ).toBe(NOW + 45);
    });
  }

  it("keeps refusing a form the picker cannot offer, deadline or not", () => {
    const { after, created } = raise({ legalFormCode: "MHA-99", legalFormDueAt: NOW + 45 });
    expect(created, "an unknown code must create no movement at all").toHaveLength(0);
    expect(after.rejections.length, "and it must be rejected rather than silently dropped").toBeGreaterThan(0);
  });
});

describe("RECORD_LEGAL_FORM_EXPIRY — typed expiries and extensions after the initial raise", () => {
  /** Raises a Form 1A with no typed expiry, then returns the movement id for the tests below to
   *  record one against — the "nothing captured yet" starting point every one of them needs. */
  function raiseFormWithNoExpiry(): { state: WardFlowState; movementId: string } {
    const { after, created } = raise({ legalFormCode: "1A" });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0]!.legalForm?.dueAt, "precondition: this movement must start with no expiry").toBeUndefined();
    return { state: after, movementId: created[0]!.id };
  }

  it("records a typed expiry against a form that has none yet", () => {
    const { state, movementId } = raiseFormWithNoExpiry();
    const recorded = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW + 10,
      movementId,
      dueAt: NOW + 500,
    });
    expect(recorded.rejections).toEqual([]);
    const updated = recorded.movements.find((movement) => movement.id === movementId)!;
    expect(updated.legalForm?.dueAt).toBe(NOW + 500);
    expect(updated.legalFormExpiryHistory).toEqual([
      { at: NOW + 10, by: "ed", dueAt: NOW + 500, basis: "written_on_form" },
    ]);
  });

  it("records an extension when a later expiry is typed against a form that already has one, and keeps dueAt equal to the last history entry", () => {
    const { state, movementId } = raiseFormWithNoExpiry();
    const firstTyped = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW + 10,
      movementId,
      dueAt: NOW + 500,
    });
    expect(firstTyped.rejections).toEqual([]);

    const extended = wardFlowReducer(firstTyped, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "coordinator",
      now: NOW + 600,
      movementId,
      dueAt: NOW + 900,
    });
    expect(extended.rejections).toEqual([]);
    const updated = extended.movements.find((movement) => movement.id === movementId)!;
    expect(updated.legalForm?.dueAt, "dueAt must equal the LAST history entry, not the first").toBe(NOW + 900);
    expect(updated.legalFormExpiryHistory).toEqual([
      { at: NOW + 10, by: "ed", dueAt: NOW + 500, basis: "written_on_form" },
      { at: NOW + 600, by: "coordinator", dueAt: NOW + 900, basis: "extension" },
    ]);
  });

  /**
   * T2r fix round, finding 2 (2026-09-17). Before this fix, `RAISE_REFERRAL`'s own capture wrote
   * `legalForm.dueAt` but never a matching `legalFormExpiryHistory` entry, so a movement raised
   * WITH a typed expiry lost that first entry — the very first expiry a clinician typed was
   * missing from the record the moment the form existed. This raises a 4A with a typed expiry at
   * referral time (not via `RECORD_LEGAL_FORM_EXPIRY`), then records an extension, and checks that
   * BOTH the raise-time capture and the extension appear in history, in order.
   */
  it("keeps the FIRST typed expiry in history when it was captured at RAISE_REFERRAL, not only later extensions", () => {
    const { after, created } = raise({ legalFormCode: "4A", legalFormDueAt: NOW + 585 });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);
    const movementId = created[0]!.id;
    expect(created[0]!.legalForm?.dueAt, "precondition: the raise-time capture must have taken").toBe(NOW + 585);
    expect(
      created[0]!.legalFormExpiryHistory,
      "the expiry typed at raise time must appear in history immediately, not only after a later extension",
    ).toEqual([{ at: NOW, by: "ed", dueAt: NOW + 585, basis: "written_on_form" }]);

    const extended = wardFlowReducer(after, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "coordinator",
      now: NOW + 700,
      movementId,
      dueAt: NOW + 660,
    });
    expect(extended.rejections).toEqual([]);
    const updated = extended.movements.find((movement) => movement.id === movementId)!;
    expect(updated.legalForm?.dueAt, "dueAt must be the extension, the LAST history entry").toBe(NOW + 660);
    expect(updated.legalFormExpiryHistory, "both entries must survive, in order").toEqual([
      { at: NOW, by: "ed", dueAt: NOW + 585, basis: "written_on_form" },
      { at: NOW + 700, by: "coordinator", dueAt: NOW + 660, basis: "extension" },
    ]);
  });

  it("refuses an extension that is not later than the expiry already recorded, with build plan §2's exact sentence", () => {
    const { state, movementId } = raiseFormWithNoExpiry();
    const firstTyped = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW + 10,
      movementId,
      dueAt: NOW + 500,
    });
    expect(firstTyped.rejections).toEqual([]);

    for (const earlierOrEqual of [NOW + 500, NOW + 499, NOW]) {
      const refused = wardFlowReducer(firstTyped, {
        type: "RECORD_LEGAL_FORM_EXPIRY",
        role: "ed",
        now: NOW + 20,
        movementId,
        dueAt: earlierOrEqual,
      });
      expect(refused.rejections.length).toBeGreaterThan(firstTyped.rejections.length);
      expect(refused.rejections.at(-1)?.reason).toBe(
        "An extension's new expiry must be later than the expiry already recorded.",
      );
      const unchanged = refused.movements.find((movement) => movement.id === movementId)!;
      expect(unchanged.legalForm?.dueAt, "a refused extension must not move the recorded expiry").toBe(NOW + 500);
    }
  });

  it("refuses a movement carrying no legal form at all, with build plan §2's exact sentence", () => {
    const { after, created } = raise({ legalFormCode: null });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0]!.legalForm, "precondition: this movement must carry no legal form").toBeUndefined();

    const refused = wardFlowReducer(after, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW + 10,
      movementId: created[0]!.id,
      dueAt: NOW + 500,
    });
    expect(refused.rejections.length).toBeGreaterThan(after.rejections.length);
    expect(refused.rejections.at(-1)?.reason).toBe("There is no legal form on this record to add an expiry to.");
  });

  it("refuses a closed movement", () => {
    const { state, movementId } = raiseFormWithNoExpiry();
    // A "revoked" examination at the movement's freshly-raised stage (`placement_requested`)
    // closes it with `did_not_proceed` — see `RECORD_EXAMINATION`'s own case for why that branch
    // fires at every stage except `handover_ready`/`moving`.
    const examined = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 5,
      movementId,
      outcome: "revoked",
    });
    const closedMovement = examined.movements.find((movement) => movement.id === movementId);
    expect(closedMovement?.closure, "precondition: the movement must be closed").toBeDefined();

    const refused = wardFlowReducer(examined, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW + 10,
      movementId,
      dueAt: NOW + 500,
    });
    expect(refused.rejections.length).toBeGreaterThan(examined.rejections.length);
    // T2r fix round, finding 11 (2026-09-17): exact fixed sentence, no longer interpolating the
    // movement's own closure reason.
    expect(refused.rejections.at(-1)?.reason).toBe("This record is closed, so no expiry can be added to it.");
  });

  /** T2r fix round, finding 8 (2026-09-17). `Instant` is a bare `number`, so nothing at the type
   *  level stops a caller sending `NaN` or `Infinity`. */
  it("refuses a non-finite dueAt", () => {
    const { state, movementId } = raiseFormWithNoExpiry();
    for (const nonFinite of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const refused = wardFlowReducer(state, {
        type: "RECORD_LEGAL_FORM_EXPIRY",
        role: "ed",
        now: NOW + 10,
        movementId,
        dueAt: nonFinite,
      });
      expect(refused.rejections.length, `${nonFinite} should have been refused`).toBeGreaterThan(
        state.rejections.length,
      );
      expect(refused.rejections.at(-1)?.reason).toBe("Enter the expiry written on the form.");
      const unchanged = refused.movements.find((movement) => movement.id === movementId)!;
      expect(unchanged.legalForm?.dueAt, "a refused non-finite value must not be stored").toBeUndefined();
    }
  });
});

/**
 * 🔴 THE SPLIT HAD ONLY EVER SEEN SEEDED ROWS, AND THE POPULATION IT WILL ACTUALLY MEET IS WIDER.
 *
 * Raised by the verifier through Ward Lead, 2026-09-12, and it is a scope correction rather than a
 * defect report: **`SELECTABLE_LEGAL_FORMS` carries no `dueAt` on ANY of its five entries.** So
 * every form a coordinator enters through the picker arrives with no deadline unless the reducer
 * writes one — and until T2 (2026-09-17), the reducer wrote one only for `transport` and
 * `transfer` kinds. **CORRECTED that date, on owner answer 1: the reducer now writes whatever due
 * time the clinician typed, for any code.** The case below that used to pin the OLD restriction —
 * a 1A dropping a supplied due time — now pins the opposite, matching
 * `ward-legal-form-due-at-capture.test.ts`'s own "every selectable code keeps a typed expiry"
 * describe block above; the case here keeps its ORIGINAL question (does a 1A with NO recorded
 * deadline still land in the no-deadline group and still get LISTED) by supplying no due time.
 *
 * ⚠️ **The group split is correct for all of it, and correct for a reason the seed cannot show.**
 * It reads `legalForm.dueAt` off the record, so a coordinator's 1A with no typed expiry lands in
 * the no-deadline group because its record holds none — NOT because its code is on a list. But
 * every case proving that until now ran over the fixture or over a constructed object, and **a
 * derivation exercised only by authored data is exactly the shape this file was written to catch
 * once already**: the four seeded deadlines made every deadline-reading path look covered while no
 * coordinator-raised patient could reach one.
 *
 * ✅ So these drive the real reducer and feed what it produces into the real split. The movements
 * are located by the id each dispatch created, never by searching for a movement with a 4A.
 *
 * 🔴 **THE THIRD CASE IS THE ONE WITH NO SEEDED ANALOGUE AT ALL**: a 4A the coordinator entered
 * WITHOUT typing a due time. Its code is one the owner opened for deadlines, and its record holds
 * none — so a split keyed on the code would file it under a clock it does not have, and the screen
 * would show a deadline column with nothing in it for a form type that is supposed to have one.
 * Every seeded 4A and 4C carries a deadline, so the fixture cannot produce this row.
 */
describe("what a coordinator raises reaches the Legal forms split, not just what the fixture holds", () => {
  it("files a coordinator's 4A WITH a typed due time in the with-deadline group", () => {
    const { after, created } = raise({ legalFormCode: "4A", legalFormDueAt: NOW + 45 });
    expect(after.rejections, "the referral must be accepted, or nothing below is exercised").toEqual([]);
    expect(created).toHaveLength(1);

    const raised = created[0]!;
    expect(raised.legalForm?.dueAt, "the precondition failed: the reducer wrote no deadline").toBe(NOW + 45);

    expect(legalFormGroupOf(raised), "a form whose record holds a real deadline was filed as having none").toBe(
      "with-deadline",
    );
    expect(
      legalFormGroupRows(after.movements, NOW, "with-deadline").map((movement) => movement.id),
      "the coordinator's own 4A never reached the deadline group the screen renders",
    ).toContain(raised.id);
  });

  /**
   * ⚠️ The interesting half is the SECOND assertion. **CORRECTED 2026-09-17, T2: this case used to
   * supply a due time and rely on the reducer dropping it — that drop is gone (owner answer 1), so
   * this now supplies none, which asks the SAME original question** — the split's own reading of a
   * genuinely absent deadline, and whether it still lists the patient — without depending on
   * behaviour this task deliberately reversed. It is asserting that the SCREEN's split reads a
   * real absence off the record and still lists the patient, rather than dropping a
   * detention-authority form off a legal screen.
   */
  it("files a coordinator's 1A with no typed expiry in the no-deadline group, and still LISTS it", () => {
    const { after, created } = raise({ legalFormCode: "1A" });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);

    const raised = created[0]!;
    expect(raised.legalForm?.dueAt, "precondition: this movement must start with no expiry").toBeUndefined();
    expect(legalFormGroupOf(raised), "a form whose record holds no deadline was filed as having one").toBe(
      "no-deadline",
    );
    expect(
      legalFormGroupRows(after.movements, NOW, "no-deadline").map((movement) => movement.id),
      "a Form 1A raised by a coordinator vanished from the Legal forms screen entirely -- the " +
        "authority to hold a person is not listed anywhere on the screen about legal forms",
    ).toContain(raised.id);
  });

  it("files a coordinator's 4A with NO typed due time in the no-deadline group, by the record and not the code", () => {
    const { after, created } = raise({ legalFormCode: "4A" });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);

    const raised = created[0]!;
    expect(raised.legalForm?.code, "the precondition failed: this is not a 4A").toBe("4A");
    expect(raised.legalForm?.dueAt, "the precondition failed: a deadline appeared from nowhere").toBeUndefined();

    expect(
      legalFormGroupOf(raised),
      "a 4A with no recorded deadline was filed under a clock it does not have. The split is " +
        "reading the form code rather than the record, and the screen will show an empty deadline " +
        "against a form type that is supposed to carry one",
    ).toBe("no-deadline");
    expect(
      legalFormGroupRows(after.movements, NOW, "no-deadline").map((movement) => movement.id),
      "the coordinator's deadline-less 4A reached neither group",
    ).toContain(raised.id);
  });
});
