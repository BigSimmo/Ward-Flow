import type { Instant } from "@/components/ward-management/ward-clock";
import type { eligibleCandidatesAmong } from "@/components/ward-management/ward-derivations";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { Movement, Unit } from "@/components/ward-management/ward-model";

/*
 * The hub's status sentence, kept apart from `flow-diagram.tsx` so Home's bed flow card can use it
 * without loading the diagram itself, which Home no longer draws (phone script budget, 19 October
 * 2026).
 */

export type ShortlistCandidate = ReturnType<typeof eligibleCandidatesAmong>[number];

/**
 * Every unit this movement is actually recorded against: the acceptance, plus every live parallel
 * referral. Not `destinationUnit()` -- that collapses both facts into one and only ever reads
 * `referredUnitIds[0]`, which is how WF-013's second referral went missing (Task 6 review
 * Important 2). Ids are returned rather than units so an id the fixture cannot resolve is still
 * counted as recorded rather than silently disappearing.
 */
export function recordedDestinationIds(movement: Movement | undefined): Set<string> {
  if (!movement) return new Set();
  const ids = new Set(movement.referredUnitIds);
  if (movement.acceptedUnitId) ids.add(movement.acceptedUnitId);
  return ids;
}

/**
 * The hub's one-line status. Must be true for every movement, not just the ones with a clean
 * eligible shortlist -- Task 6 review Critical 1 found "Routing WF-009 to 3 shortlisted units"
 * displayed for a movement whose three candidates were all ineligible (two already declined it,
 * the third fails the security gate), which reads as three viable routes where zero exist.
 *
 * Two further corrections from the whole-branch review:
 *
 * Critical 1 -- the word "nearest" is gone. `eligibleCandidatesAmong` ranks cohort-matching units
 * eligible-first and breaks ties on array order; the model holds no distance data at all, so a
 * proximity claim here was simply false.
 *
 * Important 3 -- a movement that ALREADY has a recorded destination is not looking for three of
 * them. WF-004 sits at stage `pulled` with a bed pulled at BTY Adult Secure, and this line read
 * "WF-004 -- 3 eligible destinations". The recorded fact now leads; the candidate count follows
 * as secondary context, because a coordinator may still be considering alternatives.
 *
 * Whole-branch review Critical 1: `units` is the caller's live provider `units`, never
 * `ward-sites.ts`'s `unitById`/`allUnits` — a name lookup here still must reflect a unit that
 * exists in the live world the same as any capacity figure would.
 */
// Exported for `home-bedflow.tsx` and `tests/ward-flow-diagram-status-truthfulness.test.ts`, which drives it over the whole
// fixture. The alternative was rendering the diagram fifty times in jsdom to read one string, which
// would test the renderer rather than the sentence.
export function hubStatusText(
  movement: Movement | undefined,
  shortlist: ShortlistCandidate[],
  units: Unit[],
  now: Instant,
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number — optional, so every
  // existing caller (including the status-truthfulness test) keeps compiling unchanged.
  who?: string,
) {
  if (!movement) return "Select a movement from the priority queue to route it";
  const whoLabel = who ?? "This patient";

  // "Other" means other than the units already recorded against this movement -- a candidate that
  // IS the accepted or referred unit must not be counted a second time as an alternative to itself.
  const recordedIds = recordedDestinationIds(movement);
  const otherCount = shortlist.filter((candidate) => !recordedIds.has(candidate.unit.id)).length;
  const candidateTail = otherCount === 0 ? "" : `; ${otherCount} other candidate${otherCount === 1 ? "" : "s"} shown`;

  if (movement.acceptedUnitId) {
    const accepted = units.find((unit) => unit.id === movement.acceptedUnitId);
    return accepted
      ? `${whoLabel} — accepted destination: ${accepted.name}${candidateTail}`
      : `${whoLabel} — an accepted destination is recorded but could not be resolved`;
  }
  if (movement.referredUnitIds.length > 0) {
    const names = movement.referredUnitIds
      .map((id) => units.find((unit) => unit.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length === movement.referredUnitIds.length && names.length > 0
      ? `${whoLabel} — outstanding referral${names.length === 1 ? "" : "s"}: ${names.join(", ")}${candidateTail}`
      : `${whoLabel} — ${movement.referredUnitIds.length} outstanding referral${movement.referredUnitIds.length === 1 ? "" : "s"}, not all resolvable`;
  }

  if (shortlist.length === 0) return `${whoLabel} — no destinations found for this cohort`;
  const eligibleCount = shortlist.filter((candidate) => candidate.verdict.eligible).length;
  if (eligibleCount === shortlist.length) {
    // ⚠️ **THIS SAID "3 eligible destinations" WHERE THIRTEEN WERE ELIGIBLE, and the number was
    // never network-wide.** `shortlist` is `eligibleCandidatesAmong(..., PARALLEL_REFERRAL_CAP)`,
    // which ends `.slice(0, limit)` with `limit` 3 — the three wards a coordinator may refer to in
    // parallel, not the eligible destinations that exist. `eligibleCount` is therefore a count
    // WITHIN a capped shortlist, and this branch was the only one of the three that dropped the
    // denominator and let it read as an absolute.
    //
    // ⚠️ THE OTHER TWO BRANCHES WERE ALWAYS RIGHT — "N eligible of M candidates" and "M candidates,
    // all excluded" both name the population. This one lost it precisely because the two numbers
    // were EQUAL, so the denominator looked redundant. **A count is not safe to drop just because
    // it happens to equal the numerator; it is the only thing naming what was counted.**
    //
    // The label is changed rather than the number, because the diagram beside it renders exactly
    // these candidates as nodes. Making the number network-wide would contradict what is on screen.
    // ⚠️ THE NETWORK FIGURE IS HERE BECAUSE WITHOUT IT NO GUARD CAN TELL THE TRUE LINE FROM THE
    // FALSE ONE. My first repair only rescoped the words — "all 3 candidates shown are eligible" —
    // and a property test asserting "the population size must appear in the line" PASSED against
    // the original "3 eligible destinations", because in this branch `eligibleCount` and
    // `shortlist.length` are the SAME NUMBER. The test fell into the identical trap as the code:
    // the denominator looked redundant because it equalled the numerator.
    //
    // Stating how many are eligible across the cohort makes the sentence carry a figure that only
    // a truthful version can have, so `tests/ward-flow-diagram-status-truthfulness.test.ts` has
    // something to check. It also answers the defect itself: this line understated the coordinator's
    // real options, saying three where thirteen wards could take the patient.
    const cohortEligible = units.filter(
      (unit) => unit.cohort === movement.cohort && eligibility(movement, unit, now).eligible,
    ).length;
    return cohortEligible > shortlist.length
      ? `${whoLabel} — all ${shortlist.length} shown are eligible, of ${cohortEligible} eligible across the network`
      : `${whoLabel} — all ${shortlist.length} eligible destination${shortlist.length === 1 ? "" : "s"} shown`;
  }
  if (eligibleCount === 0) {
    return `${whoLabel} — no eligible destination; ${shortlist.length} candidates, all excluded`;
  }
  return `${whoLabel} — ${eligibleCount} eligible of ${shortlist.length} candidates`;
}
