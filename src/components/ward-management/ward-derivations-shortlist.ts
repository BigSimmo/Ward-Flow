/**
 * Placement-shortlist derivations: restriction notices, eligibility warnings and the ranked shortlist
 * of candidate wards for a movement. Split out of `ward-derivations.ts`, which re-exports everything
 * here.
 */
import {
  type EligibilityGate,
  type GateResult,
  eligibility,
  wardFacingGateDetail,
} from "@/components/ward-management/ward-eligibility";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { SUITABILITY_GATES } from "@/components/ward-management/ward-flow-reducer";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { lockedBedsFree, unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";

export type RestrictionNotice = { level: "voluntary_on_locked" | "more_restrictive"; text: string };

/**
 * A ward tighter than the patient needs raises one of two warnings, and they are different things.
 * A voluntary person who cannot leave a locked ward is detained in fact without an order, which is
 * sharper than merely over-restrictive and gets its own flag. Neither blocks a placement and
 * neither touches an eligibility gate — `ward-eligibility.ts` is a protected surface.
 */
export function restrictionNotice(movement: Movement, unit: Unit): RestrictionNotice | undefined {
  /*
   * 🔴 **ONE GUARD WAS SERVING TWO DIFFERENT CLINICAL QUESTIONS, AND SPLITTING THEM RESTORES A
   * WARNING THE 2026-09-04 LOCKED/OPEN CHANGE SILENTLY REMOVED.**
   *
   * Until now both notices sat behind a single `if (unitHasOpenBeds(unit)) return undefined` —
   * wholly-locked wards only. The reasoning above is sound for `more_restrictive` and does not
   * transfer to `voluntary_on_locked`, and its author said so: it disclaims owner authority and
   * argues only the `more_restrictive` case in detail.
   *
   *   MORE_RESTRICTIVE   asks "is this ward tighter than this patient needs?" That is a question
   *                      about the WARD's character. A mostly-open mixed ward is not "a locked
   *                      ward", so calling it one would be the ward-level/bed-level conflation the
   *                      owner's ruling warns against. **Unchanged: wholly locked only.**
   *
   *   VOLUNTARY_ON_LOCKED asks "might this voluntary patient end up unable to walk out?" That is a
   *                      question about the BED, and a mixed ward has locked beds in it. **Fires
   *                      for any ward with a locked bed.**
   *
   * ⚠️ **WHAT THE OLD SHARED GUARD DID, WHICH IS WHY THIS IS A REGRESSION RATHER THAN A
   * PREFERENCE.** Before the split every "Secure" ward raised the voluntary warning. After it, only
   * wholly-locked wards did — so `bty-adult-secure`, **the owner's own worked example of a mixed
   * ward** (4 of 17 locked, "Ward 7 in Bentley is a locked/Open ward"), stopped warning that a
   * voluntary patient might be placed behind its locked doors. A change made to stop the app giving
   * a wrong clinical answer had quietly removed a clinical warning.
   *
   * **The notice is informational and gates nothing** — it never blocks a placement. So the failure
   * directions are not symmetric: firing on a mixed ward costs a coordinator one sentence they can
   * dismiss, and not firing costs them the only prompt to check a voluntary patient's legal status
   * before admission. **Erring toward the sentence.**
   *
   * ⚠️ **NOTHING PINNED THE MIXED CASE IN EITHER DIRECTION.** `ward-restriction-notice.test.ts`
   * only ever exercised a wholly-locked ward and a wholly-open one, so the old condition passed
   * everywhere because nothing tested the case it changed — not because it was confirmed correct.
   *
   * **This is Ward Lead's ruling, not the owner's, and it is cheap to reverse.** It is recorded for
   * him as a decision taken rather than a default that happened.
   */
  if (movement.legalStatus === "Voluntary") {
    if (!unitHasLockedBeds(unit)) return undefined;
    return {
      level: "voluntary_on_locked",
      text: "Voluntary patient on a locked ward — review legal status before admission",
    };
  }
  if (unitHasOpenBeds(unit)) return undefined;
  if (movement.security === "Open") {
    return { level: "more_restrictive", text: "More restrictive than this movement requires" };
  }
  return undefined;
}

export type EligibilityWarning = { level: "ineligible"; text: string; failedGates: GateResult[] };

/**
 * The other half of the finding in `docs/ward-flow/archive/dated-notes/the-engine-enforces-nothing.md`: `eligibility()`
 * already computes whether this ward may lawfully or safely hold this movement, and nothing on the
 * ward's own screen showed it. `ward-screen.tsx`'s accept and pull buttons deliberately mirror the
 * reducer's own (eligibility-free) checks so the two can never advertise different verdicts — which
 * means their silent agreement reads as "nothing wrong" even on a movement `eligibility()` would
 * refuse outright. This is INFORMATION, never a gate: it never blocks accept or pull, and it calls
 * `eligibility()` exactly as written — `ward-eligibility.ts` is a protected surface and its pass/fail
 * semantics are untouched here, the same discipline `restrictionNotice` above already keeps.
 *
 * Independent of `restrictionNotice`, not a second copy of it: that function flags a ward MORE
 * restrictive than a movement strictly needs (never itself a hard `eligibility()` failure — its
 * `security` gate only fails the other direction, a movement needing Secure placed on an Open
 * ward), or a voluntary patient held on a locked ward (a fact `eligibility()` does not gate on at
 * all — its `authorisation` gate only fires for a NON-voluntary movement). Neither of
 * `restrictionNotice`'s two cases can coincide with a failing `eligibility()` gate for the same
 * pair, so a case already flagged there never also earns this warning for the same underlying fact.
 *
 * Lists EVERY failing gate's own `detail`, never just the first — `candidateReason()` deliberately
 * picks one gate for a single-line "why not eligible" summary elsewhere on the coordinator's
 * screen; a ward silently told about only one of several problems would read as complete when it
 * is not.
 */
export function eligibilityWarning(movement: Movement, unit: Unit, now: Instant): EligibilityWarning | undefined {
  const failedGates = eligibility(movement, unit, now).gates.filter((gate) => !gate.pass);
  if (failedGates.length === 0) return undefined;
  return {
    level: "ineligible",
    // Opus review round 2, 17 September 2026 (P2), privacy: `wardFacingGateDetail` — never
    // `gate.detail` directly — is what keeps this ward/ED-facing warning from ever joining in the
    // `gender_designation` gate's own "female only"/"Record gender first" wording. This is the
    // only caller of `eligibilityWarning` today (`ward-screen.tsx`, both presentation modes).
    text: `Does not meet every placement requirement: ${failedGates.map((gate) => wardFacingGateDetail(gate)).join("; ")}`,
    failedGates,
  };
}

/**
 * The units among `units` whose cohort matches this movement's, ranked eligible-first using the
 * real eligibility gates, then truncated to `limit`.
 *
 * This is NOT a proximity ranking, and must never be described as one. `Unit` carries no
 * distance, geo, locality or catchment field, and `Movement` carries no catchment either
 * (see `movementHealthService`), so no surface in this prototype can honestly claim a
 * "nearest" anything. Whole-branch review Critical 1 found exactly that claim on screen:
 * WF-018, sitting in SCGH's own emergency department, was offered "RPH Older Adult" first and
 * its own SCGH ward second under a heading reading "Nearest candidates". The tie order below is
 * simply `units`' own array order.
 *
 * Task 5: within that same top-`limit` set, a candidate matching the movement's own security
 * requirement is ranked ahead of a restricted one — see the two-pass reasoning in the body below.
 *
 * This is a shortlist of candidates, never a destination — a unit appearing here has not been
 * referred or accepted; see `destinationUnit` for the movement's actual recorded destination.
 *
 * Whole-branch review Critical 1: this is the function root-caused by the review as reading the
 * frozen fixture on every live surface (a ward's own confirmed capacity could drop to zero and
 * the coordinator's shortlist would still read "Eligible now" for it). It now takes `units` as a
 * parameter instead of reading `allUnits()` itself — every live caller must pass the provider's
 * live `units`, never the frozen fixture. `units` is REQUIRED and deliberately has no default —
 * a defaulted `units = allUnits()` would let every existing call site keep compiling while
 * silently reading frozen capacity again, which is precisely how the original defect survived.
 * The frozen wrapper this comment used to point at was deleted in R70; nothing reads the fixture
 * at render time any more, and `tests/ward-flow-single-source.test.ts` enforces that with a
 * TypeScript-parser walk rather than a text scan.
 */
/**
 * ⚠️ WHAT A WARD IS TO THIS MOVEMENT, IN THE ONLY THREE STATES A COORDINATOR CAN ACT ON.
 *
 * `eligible`    — take it.
 * `overridable` — every failing gate is a JUDGEMENT about the patient, so a named human may take
 *                 it by recording why. The engine will accept that; see `eligibilityRefusal`.
 * `unavailable` — at least one failing gate is a FACT ABOUT THE WORLD: no bed, no specialling
 *                 capacity, a stale count. ⚠️ NO REASON BUYS PAST THESE, and a list that styled
 *                 them like an overridable ward would be offering a coordinator something they can
 *                 never have. The owner's rule: no reason typed into a form creates a bed.
 */
export type ShortlistAvailability = "eligible" | "previously_declined" | "overridable" | "waitlist" | "unavailable";

/**
 * ⚠️ GATES THAT INFORM AND DO NOT BLOCK — a third kind, and neither of the two this file started
 * with fits them.
 *
 * `prior_decline` says a ward has already said no to this person once. The owner ruled that
 * re-approaching such a ward needs NO WRITTEN REASON, and the reducer already agrees: the gate is
 * absent from `SUITABILITY_GATES`, so `eligibilityRefusal` never sees it and a re-approach passes
 * with no friction at all.
 *
 * ⚠️ SO IT MUST NOT BE MOVED INTO `SUITABILITY_GATES` TO FIX THIS. That would make it
 * overridable-WITH-a-reason, which is the thing he ruled against. It needs its own bucket, not a
 * move between the two that exist.
 *
 * A ward that declined at 2pm because it was full, with a bed free at 8pm, must remain reachable —
 * and the coordinator must still SEE that it said no before, because that is useful. The
 * information is useful; the block was wrong.
 */
/**
 * ⚠️ EXPORTED SO IT CAN BE PINNED AGAINST THE ENGINE, NOT SO IT CAN BE IMPORTED FOR CONVENIENCE.
 * `tests/ward-informational-gates.test.ts` proves, for EVERY member, that the reducer genuinely
 * accepts a referral to a ward failing only that gate with NOTHING recorded. Adding a member with
 * no such case makes that test fail rather than pass quietly — the list cannot outrun the engine.
 */
export const INFORMATIONAL_GATES: readonly EligibilityGate[] = ["prior_decline"];

/**
 * ⚠️ THE ONE PLACE THAT SAYS WHICH WARDS A COORDINATOR MAY SIMPLY REFER TO — and it exists because
 * the screen asked a DIFFERENT QUESTION from this file and got a different answer.
 *
 * `verdict.eligible` is false for a previously-declining ward, because `prior_decline` genuinely
 * fails as a gate. So a control that reads `verdict.eligible` to decide whether Refer is available
 * blocks a ward the owner ruled needs NO WRITTEN REASON — and the disabled control then reads
 * "Not eligible … Use Override instead", which demands the very reason he ruled against.
 *
 * ⚠️ THAT IS WHAT SHIPPED IN `4e07bf520`, AND IT IS WORTH BEING PRECISE ABOUT WHAT WENT WRONG: the
 * ward moved into the candidates list correctly, and THE SAME FALSE CLAIM REAPPEARED ON THE REFER
 * BUTTON. The falsehood was not removed, it was MOVED. The list read `availability`; the button
 * read `verdict.eligible`; nothing made them agree, and nothing went red.
 *
 * ⚠️ A browser check passed over it, because it searched for the sentence that had been REMOVED and
 * that sentence was genuinely gone. Confirming the old wording is absent is not confirming the
 * screen is right.
 *
 * Every consumer deciding "may this be referred with nothing recorded?" calls THIS, never
 * `verdict.eligible`.
 */
export function needsNoRecordedReason(availability: ShortlistAvailability): boolean {
  return availability === "eligible" || availability === "previously_declined";
}

export type ShortlistCandidate = {
  unit: Unit;
  verdict: ReturnType<typeof eligibility>;
  availability: ShortlistAvailability;
  /** A fact, not an order: an in-catchment ward of the same cohort with no bed free now. */
  waitlist?: boolean;
};

function isCatchmentUnit(movement: Movement, unit: Unit): boolean {
  if (movement.homeRegion && unit.homeRegion) {
    return movement.homeRegion === unit.homeRegion;
  }
  const originEd = edById(movement.originEdId);
  const edSiteCode =
    originEd?.siteCode ?? (movement.originEdId ? movement.originEdId.replace(/^ed-/, "").toUpperCase() : undefined);
  if (edSiteCode && unit.siteCode && edSiteCode.toUpperCase() === unit.siteCode.toUpperCase()) {
    return true;
  }
  if (edSiteCode && unit.siteCode) {
    const originSite = siteByCode(edSiteCode);
    const unitSite = siteByCode(unit.siteCode);
    if (originSite?.service && unitSite?.service && originSite.service === unitSite.service) {
      return true;
    }
  }
  return false;
}

/**
 * EVERY ward, with an honest verdict on each — never a pre-filtered list.
 *
 * ⚠️ IT REPLACES A FILTER THAT MADE WARDS INVISIBLE RATHER THAN REFUSED. `eligibleCandidatesAmong`
 * drops every unit of a different cohort BEFORE eligibility is computed, so those wards could never
 * be seen, never be reasoned about, and never be overridden — they simply were not there.
 *
 * ⚠️ AND HIDING THEM WAS DEFENSIBLE UNTIL TONIGHT. While the engine refused a mismatched placement
 * outright, showing a coordinator a ward they could not use was noise. Now a judgement gate is
 * overridable with a recorded reason, so a cohort-mismatched ward is a LEGITIMATE DESTINATION and
 * hiding it is the defect. `cohort` is itself one of the overridable gates.
 *
 * ⚠️ NO LIMIT, DELIBERATELY, and this is the part that must not be undone. The list it replaces was
 * capped at `PARALLEL_REFERRAL_CAP` — a rule about how many places ONE REFERRAL MAY BE SENT TO,
 * borrowed as a display count, which is a domain rule doing a layout job. Re-capping would restore
 * the original defect in a new costume: with three eligible wards present, every overridable one
 * would fall off the end and be invisible again. Order it, group it, scroll it — do not truncate it.
 */
export function shortlistCandidates(movement: Movement, units: Unit[], now: Instant): ShortlistCandidate[] {
  /*
   * Audit 1, Josh 20 Oct (NB-4): grouped by fit, then a fixed neutral order inside each group
   * (health service, then ward name). The catchment and free-bed tiers that used to order a
   * secure-bed patient's wards (owner ruling 18-19 Sept) are gone: never-build item 2.
   */
  return units
    .map((unit) => {
      const verdict = closureAwareVerdict(unit, eligibility(movement, unit, now));
      const failing = verdict.gates.filter((gate) => !gate.pass);
      /*
       * 🔴 Owner reversal, item 2, 17 September 2026: a Non-binary movement failing ONLY
       * `gender_designation` at a single-gender ward is not a dead end — a coordinator can still
       * clear it by recording a `GenderPlacement` for this unit (`ward-eligibility.ts`'s own
       * `genderDesignationResult`). Filtering it into `unavailable` would hide that path exactly
       * the way an Undesignated ward's own gender-placement requirement is never hidden — this
       * unit must stay offerable so the gender-placement form (shown by `needsGenderPlacement` in
       * `shortlist-panel.tsx`, already keyed on `movement.gender`/`genderPlacements`) can reach it.
       * Scoped tightly: only when `gender_designation` is the SOLE failing gate, so a ward that is
       * also cohort-mismatched or full stays in its ordinary bucket.
       */
      const genderPlacementPending =
        // R7 (25 September 2026): any gender that is not female or male, including not recorded.
        movement.gender !== "Female" &&
        movement.gender !== "Male" &&
        failing.length === 1 &&
        failing[0].gate === "gender_designation" &&
        !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(unit.id));
      // ⚠️ Fail-closed by construction, the same rule the engine applies: a gate is overridable ONLY
      // by appearing in `SUITABILITY_GATES`. Anything else — including a gate added later by
      // somebody who never opened this file — makes the ward unavailable rather than overridable.
      const blocking = failing.filter(
        (gate) =>
          !SUITABILITY_GATES.includes(gate.gate) &&
          !INFORMATIONAL_GATES.includes(gate.gate) &&
          !(genderPlacementPending && gate.gate === "gender_designation"),
      );
      const judgements = failing.filter((gate) => SUITABILITY_GATES.includes(gate.gate));
      const availability: ShortlistAvailability = verdict.eligible
        ? "eligible"
        : blocking.length > 0
          ? "unavailable"
          : judgements.length > 0
            ? "overridable"
            : // Only informational gates failed — usable, needing nothing, with a note.
              "previously_declined";

      const available = movement.security === "Secure" ? lockedBedsFree(unit) : unit.allocatable.value;

      return {
        unit,
        verdict,
        availability,
        // In catchment, same cohort, no bed now: shown as "waitlist for a locked bed". Never an order.
        waitlist: unit.cohort === movement.cohort && isCatchmentUnit(movement, unit) && available === 0,
      };
    })
    .sort((a, b) => rankOf(a.availability) - rankOf(b.availability) || byServiceThenName(a.unit, b.unit));
}

/** The one fixed, neutral order inside a group: health service, then ward name. Nothing is ranked. */
function byServiceThenName(a: Unit, b: Unit): number {
  const service = (unit: Unit) => siteByCode(unit.siteCode)?.service ?? "";
  return service(a).localeCompare(service(b)) || a.name.localeCompare(b.name);
}

/**
 * The gate to SHOW against a ward nothing can buy — the first failing gate OUTSIDE the overridable
 * set, falling back to the first failing gate at all.
 *
 * ⚠️ IT EXISTS BECAUSE THE OBVIOUS VERSION IS WRONG IN THE DANGEROUS DIRECTION, and it was caught
 * by looking at the rendered screen rather than by a test. Taking simply the first failing gate
 * showed "Open ward does not meet a secure requirement" against a ward that is unavailable because
 * it HAS NO BED — naming an OVERRIDABLE reason on a row no reason can buy. A coordinator reading
 * that would reasonably conclude a recorded reason would get them in.
 *
 * The fallback is unreachable for an `unavailable` candidate by construction, and is kept so the
 * function is total for any verdict a caller hands it.
 */
export function blockingGate(verdict: ReturnType<typeof eligibility>) {
  return (
    verdict.gates.find(
      (gate) => !gate.pass && !SUITABILITY_GATES.includes(gate.gate) && !INFORMATIONAL_GATES.includes(gate.gate),
    ) ?? verdict.gates.find((gate) => !gate.pass)
  );
}

/**
 * Owner decision, 17 October 2026: a closed ward is not offered as a destination. The pull itself
 * already refuses a new reservation there (`ward-flow-placement-events.ts`), so this only stops the
 * lists offering what the pull would refuse. It returns the LIST's own copy of the verdict:
 * `eligibility()` and the lenient `allocatable_bed` pull rule are unchanged, and the reason shown
 * names the closure rather than a bed count. Shared by `shortlistCandidates` and
 * `eligibleCandidatesAmong`, so the shortlist and the Home bedflow agree.
 */
function closureAwareVerdict(unit: Unit, verdict: ReturnType<typeof eligibility>): ReturnType<typeof eligibility> {
  if (!unit.isClosed) return verdict;
  return {
    eligible: false,
    gates: verdict.gates.map((gate) =>
      gate.gate === "allocatable_bed"
        ? { ...gate, pass: false, detail: `${unit.name} is closed; a new bed cannot be reserved there` }
        : gate,
    ),
  };
}

/** Eligible first, then what a reason can buy, then what nothing can. Inside each group the order is
 *  `byServiceThenName`, so nothing is ranked against its neighbours. */
function rankOf(availability: ShortlistAvailability): number {
  if (availability === "eligible") return 0;
  // A ward that only declined before needs nothing recorded, so it sits above one that does.
  if (availability === "previously_declined") return 1;
  if (availability === "overridable") return 2;
  if (availability === "waitlist") return 3;
  return 4;
}

/**
 * Same-cohort wards, eligible first, then a fixed neutral order (health service, then ward name).
 * Audit 1, Josh 20 Oct (NB-4): the "least restrictive first" reorder is gone; a coordinator is not
 * steered toward one eligible ward over another. Every ward is returned unless a caller passes
 * `limit`: the old default of 3 was a latent top-three list (NB-26-03, 26 Oct 2026), and
 * `tests/ward-never-build-drift-guard.test.ts` pins that no screen passes a cap.
 */
export function eligibleCandidatesAmong(movement: Movement, units: Unit[], now: Instant, limit?: number) {
  return units
    .filter((unit) => unit.cohort === movement.cohort)
    .map((unit) => ({ unit, verdict: closureAwareVerdict(unit, eligibility(movement, unit, now)) }))
    .sort((a, b) => Number(b.verdict.eligible) - Number(a.verdict.eligible) || byServiceThenName(a.unit, b.unit))
    .slice(0, limit ?? units.length);
}
