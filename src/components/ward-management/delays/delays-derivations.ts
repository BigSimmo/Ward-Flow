import type { WardBarSegment } from "@/components/ward-management/ward-bar";
// ⚠️ CORRECTION 4. `Instant` is exported by ward-clock, not ward-model — the plan imported it from
// ward-model, which is a type error the test suite could never have caught, because vitest does not
// typecheck. All seven tests were green with this broken.
import {
  clockState,
  dayOf,
  MINUTES_PER_DAY,
  minuteOfDay,
  minutesUntil,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  destinationNoLongerLawful,
  isOpen,
  referralForMovement,
  shortlistCandidates,
} from "@/components/ward-management/ward-derivations";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import {
  LONG_WAIT_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
  REMINDER_MORNING_SHIFT_END_MINUTE,
  REMINDER_MORNING_SHIFT_START_MINUTE,
  SHIFT_PATTERN,
  SILENT_WARD_FIRST_REMINDER_MINUTES,
  SILENT_WARD_SECOND_REMINDER_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";

export type DelayCause =
  // ⚠️ AUDIT GAP 3 CLOSED. This used to be one cause, `legal_expiring`, covering both
  // `clockState` "breached" (already passed) and "critical" (under an hour, not yet passed).
  // The old exceptions inbox kept these visibly separate — a breach reads as "Legal timing
  // breached" (`buildActionInbox`, ward-derivations.ts) and is a materially worse fact than a
  // clock still running. Merging them lost that distinction with no compensating signal, since a
  // `DelayGroup` carries no per-movement detail a caller could use to tell the two apart. Split
  // back into two causes; `legal_breached` outranks `legal_expiring` in `ORDER` below because a
  // passed deadline is worse than an approaching one.
  | "legal_breached"
  | "legal_expiring"
  | "no_eligible_bed"
  | "awaiting_ward_answer"
  // ⚠️ AUDIT GAP 1 CLOSED. The exceptions inbox's "Bed pull expired" category
  // (`buildActionInbox`, ward-derivations.ts) had no equivalent here: every `stage === "pulled"`
  // movement fell into `awaiting_bed_ready` regardless of whether the hold had lapsed, so an
  // expired reservation was indistinguishable from one still running. Condition mirrored exactly
  // from `buildActionInbox`'s `expiredBedPulls` filter. Ranked above `awaiting_bed_ready` — a
  // lapsed hold is worse than one still counting down.
  | "bed_pull_expired"
  | "awaiting_bed_ready"
  | "awaiting_transport"
  | "patient_or_family"
  | "awaiting_coordinator";

export type DelayGroup = { cause: DelayCause; title: string; note: string; movements: Movement[] };

const ORDER: { cause: DelayCause; title: string; note: string }[] = [
  {
    cause: "legal_breached",
    title: "Form due time already passed",
    note: "nothing else on this page outranks it",
  },
  {
    cause: "legal_expiring",
    title: "Form due time running out",
    note: "",
  },
  { cause: "no_eligible_bed", title: "No suitable bed anywhere in the network", note: "" },
  { cause: "awaiting_ward_answer", title: "Awaiting a ward's answer", note: "" },
  // ⚠️ The note said "the hold lapsed" until 2026-09-06 — the same event named two ways inside one
  // object literal, with the title already calling it a pull. That was recorded as an open question
  // for the owner rather than decided; he has since ruled that a reserved bed is a PULL, so it is
  // decided and applied here. The word "hold" is not banned anywhere: this is one site changed to
  // match a ruling, not a prohibition.
  {
    cause: "bed_pull_expired",
    title: "Reserved time has passed, bed still held",
    note: "Release the bed or set a new reserved time",
  },
  { cause: "awaiting_bed_ready", title: "Awaiting the bed itself", note: "each has a named bed" },
  { cause: "awaiting_transport", title: "Awaiting transport", note: "" },
  { cause: "patient_or_family", title: "Patient or family factors", note: "" },
  { cause: "awaiting_coordinator", title: "Awaiting a decision from the coordinator", note: "that is you" },
];

/** Every cause, worst first — the ranking itself, so a caller can reason about position rather than
 *  hand-listing members. Derived from `ORDER`, never a second list. */
export const DELAY_CAUSE_ORDER: readonly DelayCause[] = ORDER.map((entry) => entry.cause);

/**
 * The copy table itself, exported READ-ONLY for `tests/ward-delay-cause-vocabulary.test.ts`.
 *
 * ⚠️ **Exported so a guard can walk EVERY entry, not just the populated ones.** `delayGroups()`
 * returns only causes that have movements today, so a guard reading it would silently skip any
 * entry the fixture happens not to fill — and an entry nothing renders is exactly where a
 * half-renamed pair survives longest. This is the same reason `DELAY_CAUSE_ORDER` is derived from
 * `ORDER` rather than hand-listed: one table, read two ways, never copied.
 */
export const DELAY_CAUSE_COPY: readonly {
  readonly cause: DelayCause;
  readonly title: string;
  readonly note: string;
}[] = ORDER;

/**
 * 🔴 **THE CAUSES NOTHING ROUTINE RESOLVES — HERE, BESIDE THE RANKING, BECAUSE THE TWO DISAGREED.**
 *
 * This lived as a hand-written predicate in `delays-screen.tsx`. When `legal_expiring` was split
 * into `legal_breached` + `legal_expiring`, the ranking gained the worse case and that predicate
 * did not — so **the lapsed authority rendered as routine and the merely-approaching one rendered as
 * danger.** The severity was inverted and nothing failed, because no movement in the seed is
 * breached, so the group is empty and the defect is latent.
 *
 * ⚠️ **A string union does not protect you here: every predicate naming members by hand still
 * typechecks after a split.** Keeping the band next to the order it must agree with is the fix;
 * `tests/ward-delays-derivations.test.ts` pins that severity is a contiguous PREFIX of the ranking,
 * so a new cause inserted above the band without being named here goes red.
 */
export const SEVERE_CAUSES: readonly DelayCause[] = ["legal_breached", "legal_expiring", "no_eligible_bed"];

/**
 * WHO CAN ACTUALLY CLEAR A DELAY — the owner's own five headings, in his own words, for the
 * three-column working surface. This is a SECOND grouping over the same causes `ORDER` already
 * ranks: `ORDER`/`DELAY_CAUSE_ORDER` answers "how bad", this answers "whose move is it next". The
 * two never merge into one list — a coordinator scanning by owner still needs the underlying
 * severity to sort within a column, which is why `ownerOf` maps a `DelayCause` rather than
 * replacing it.
 */
export type DelayOwnerId = "yours" | "wards" | "ed" | "transport" | "other";

export const DELAY_OWNERS: readonly { readonly id: DelayOwnerId; readonly name: string; readonly subLine: string }[] = [
  { id: "yours", name: "Yours", subLine: "Your decision, or a legal form's due time running out" },
  { id: "wards", name: "Wards", subLine: "Waiting on a ward to answer or a bed to be ready" },
  { id: "ed", name: "ED", subLine: "Waiting on the referring department" },
  { id: "transport", name: "Transport", subLine: "Waiting on a vehicle or an escort" },
  { id: "other", name: "Other", subLine: "Everything else holding somebody up" },
];

/**
 * THE MAPPING ITSELF, AND WHY EACH LINE IS WHERE IT IS — `Record<DelayCause, DelayOwnerId>` so the
 * compiler refuses a `DelayCause` with no entry here, the same total-map discipline
 * `stepBackReasonLabels` (ward-model.ts) uses for its own fixed list. ⚠️ **THAT COMPILE-TIME
 * GUARANTEE IS NOT ENOUGH ON ITS OWN** — this repository's own top-of-file correction records that
 * vitest never typechecks, so a broken map could still ship green. `tests/ward-delays-derivations.test.ts`
 * therefore re-proves totality at RUNTIME by walking `DELAY_CAUSE_ORDER` itself rather than a
 * hand-copied list of causes — a cause added there with no line added here reads its missing key as
 * `undefined` at runtime regardless of what the type system would have said, and that test catches
 * exactly that.
 *
 * ⚠️ **THREE OF THESE NINE LINES ARE NOT A MEASUREMENT, AND ALL THREE ARE MARKED WHERE THEY ARE
 * MADE** — in two places: the two legal causes (now an OWNER RULING, no longer this file's judgement
 * call) and `patient_or_family` (still a judgement call). The other six read directly off what the
 * cause's own `ORDER` entry already says it means. The count in this sentence said "two" while three
 * lines were marked; if you move a line in or out, correct it here as well.
 */
const CAUSE_OWNERS: Record<DelayCause, DelayOwnerId> = {
  // ⚠️ OWNER RULING, 2026-09-08, OVERTURNING THE JUDGEMENT CALL RECORDED HERE BEFORE IT. These two
  // sat under `other`, and the reasoning was sound as far as it went: `legalForm.dueAt` is populated,
  // per that field's own doc comment in ward-model.ts, ONLY by the transport/transfer forms
  // (4A "Transport order", 4C "Transfer between authorised hospitals") — a Form 1A or 3B never
  // carries one — so a legal deadline running out is a STATUTORY CLOCK ATTACHED TO A TRANSPORT
  // AUTHORISATION, not a live request sitting with a named party the way the other eight causes are.
  // Nobody is failing to answer, and the clock runs regardless of what the coordinator decides.
  //
  // 🔴 THE OWNER OVERRULED THAT ON THE GROUND THE ARGUMENT NEVER ADDRESSED: WHERE THE EYE GOES.
  // `ORDER` (this file, above) ranks `legal_breached` first and says of it "nothing else on this page
  // outranks it". Filing the single most urgent thing the screen can show under a heading that reads
  // "Everything else holding somebody up" is a placement decision, and it was losing to a
  // classification decision. A coordinator reads "Other" last.
  //
  // ⚠️ THE MOVE MADE THE "yours" SUBLINE FALSE, AND THE SUBLINE WAS CHANGED WITH IT — see
  // `DELAY_OWNERS` above. "Waiting on a decision only you can make" was true of `awaiting_coordinator`
  // and is NOT true of a statutory clock. A group whose heading no longer describes its own contents
  // is how a truthful screen starts lying, and moving a row without re-reading the heading over it is
  // exactly how that happens. If either of these two causes is ever moved back out, read that subLine
  // again before you do.
  legal_breached: "yours",
  legal_expiring: "yours",
  // The network as a whole has no eligible bed — still fundamentally a BED/WARD capacity fact, only
  // at the scale of every ward rather than one, so it sits with the rest of the bed-and-ward group
  // rather than under "yours": there is nothing a coordinator can decide that manufactures a bed.
  no_eligible_bed: "wards",
  awaiting_ward_answer: "wards",
  bed_pull_expired: "wards",
  awaiting_bed_ready: "wards",
  awaiting_transport: "transport",
  // ⚠️ JUDGEMENT CALL. Neither the patient nor the family is one of the four named parties, and
  // nothing here is "a decision only the coordinator can make" — it is waiting on the patient or
  // family themselves, which the five headings have no slot for. `other` per this task's own
  // instruction for a genuinely ambiguous cause.
  patient_or_family: "other",
  // Per this task's own instruction: `awaiting_coordinator` is the unconditional fallback cause, so
  // it belongs to "yours".
  awaiting_coordinator: "yours",
};

export function ownerOf(cause: DelayCause): DelayOwnerId {
  return CAUSE_OWNERS[cause];
}

/**
 * ⚠️ **ONE MOVEMENT, ONE CAUSE, FIRST MATCH WINS.** A patient routinely satisfies several of these
 * at once — that is the whole reason the three old screens listed the same people three times. The
 * row sits under the highest-ranked cause and the rest show as state words on the row.
 *
 * ⚠️ **The list is the owner's ruling that a fixed list of delay kinds EXISTS. Its exact membership
 * is a clinical question the owner has NOT ruled on** (design lock §7). Do not add a cause here
 * without asking him.
 *
 * ⚠️ **THREE CONDITIONS HERE DIFFER FROM THE PLAN THAT SPECIFIED THEM, because the plan's versions
 * do not hold against this codebase. Each is named where it is fixed.** They are recorded rather
 * than quietly corrected because two of the three would have emptied a group silently, and an empty
 * group is dropped from the screen — so the failure would have looked like "nothing is wrong in
 * that category" rather than like a defect.
 */
export function delayGroups(movements: Movement[], units: Unit[], now: Instant): DelayGroup[] {
  const causeOf = (movement: Movement): DelayCause => {
    // ⚠️ CORRECTION 1. The plan wrote `clockState(...) !== "ok"`. `ClockState` has no member "ok" —
    // it is "breached" | "critical" | "due" | "clear" — so that comparison is a type error, and had
    // it compiled it would have been true for every movement carrying a dueAt, putting the whole
    // fixture in this group.
    //
    // ⚠️ AND THE REPLACEMENT IS A JUDGEMENT, NOT A MEASUREMENT. "Running out" is read here as
    // breached or critical (already past, or under an hour). "due" — under three hours — is
    // deliberately excluded, because a top group that holds a third of the screen directs the eye
    // nowhere, which is the same failure as flagging every tile amber. The thresholds themselves
    // are `clockState`'s own and are not invented here, but WHICH of them count as "running out"
    // is the plan author's reading and the owner has not ruled on it.
    //
    // ⚠️ AUDIT GAP 3: breached and critical used to collapse into one cause here. They are now
    // two returns instead of one `||`, so a caller can rank and label a passed deadline
    // differently from an approaching one. As of this fixture, no seeded movement's legal form
    // is actually breached or critical (the four `dueAt` values in ward-movements.ts are all
    // "due" or "clear" against NOW_ANCHOR) — both branches are real and reachable, but neither
    // is exercised by today's data. See the test file for how that is proved rather than assumed.
    const legal = movement.legalForm?.dueAt;
    if (legal !== undefined) {
      const state = clockState(legal, now);
      if (state === "breached") return "legal_breached";
      if (state === "critical") return "legal_expiring";
    }

    if (destinationNoLongerLawful(movement, units) !== undefined) return "no_eligible_bed";

    // ⚠️ CORRECTION 2, AND IT IS THE ONE THAT MATTERED. The plan wrote
    // `shortlistCandidates(movement, units, now).length === 0`. That function returns EVERY ward
    // with an honest verdict on each and never a pre-filtered list — its own doc comment says so in
    // capitals — so its length is zero only when the network holds no wards at all. This group
    // would have been permanently empty, and an empty group is dropped, so the two people with
    // nowhere to go would simply not have appeared on the screen built to find them.
    if (movement.acceptedUnitId === undefined) {
      const candidates = shortlistCandidates(movement, units, now);
      if (!candidates.some((candidate) => candidate.availability === "eligible")) return "no_eligible_bed";
    }

    if (movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0) {
      return "awaiting_ward_answer";
    }
    if (movement.stage === "pulled") {
      // ⚠️ AUDIT GAP 1: condition mirrored exactly from `buildActionInbox`'s `expiredBedPulls`
      // filter (ward-derivations.ts) — `stage === "pulled" && pullExpiresAt !== undefined &&
      // pullExpiresAt < now`. Do not let this drift from that one independently; the two screens
      // must agree on which holds count as expired.
      if (movement.pullExpiresAt !== undefined && movement.pullExpiresAt < now) return "bed_pull_expired";
      return "awaiting_bed_ready";
    }
    if (movement.transport !== undefined) return "awaiting_transport";
    // ⚠️ CORRECTION 3. The plan wrote `movement.urgentFlag`. The field is `flaggedUrgent`
    // (ward-model.ts) and `urgentFlag` exists nowhere in this codebase, so the plan's line would
    // not have compiled.
    if (movement.flaggedUrgent) return "patient_or_family";
    return "awaiting_coordinator";
  };

  const open = movements.filter(isOpen);
  const causeByMovementId = new Map<string, DelayCause>();
  for (const movement of open) {
    causeByMovementId.set(movement.id, causeOf(movement));
  }

  return ORDER.map((entry) => ({
    ...entry,
    movements: open.filter((movement) => causeByMovementId.get(movement.id) === entry.cause),
  })).filter((group) => group.movements.length > 0);
}

/**
 * ⚠️ AUDIT GAP 2 CLOSED. `delayGroups` above answers "which cause" a movement's legal deadline
 * falls under — a category, not a number. The exceptions inbox it replaces rendered the actual
 * figure (`buildActionInbox`'s `formatRemaining(minutesUntil(dueAt, now))`, ward-derivations.ts),
 * and that number is lost once all a caller can see is which bucket a movement landed in. This
 * returns the raw minutes straight from `minutesUntil` — negative once the deadline has passed,
 * positive while time remains, `undefined` when the movement carries no legal deadline at all
 * (every Form 1A and 3B in this model, per the 2026-08-23 product-owner correction recorded on
 * `LegalForm` in ward-model.ts). Formatting (`formatRemaining`) is deliberately left to the
 * screen, per this task's instruction — this function hands over the fact, not its rendering.
 */
export function legalDeadlineMinutes(movement: Movement, now: Instant): number | undefined {
  const dueAt = movement.legalForm?.dueAt;
  if (dueAt === undefined) return undefined;
  return minutesUntil(dueAt, now);
}

/**
 * 🔴 **REPLACES A NUMBER THE MODEL COULD NEVER HAVE PRODUCED.** The mockup drew "stuck on this
 * blocker for 26h" — a duration since the movement's CURRENT blocker started. That has no start
 * instant anywhere in this model: `Movement.blocker` (ward-model.ts) is free prose overwritten in
 * place with no timestamp of its own, and of the nine `DelayCause`s only two — `bed_pull_expired`
 * (`pullExpiresAt`, itself an expiry, not a start) and `awaiting_transport` (a `TransportJob`
 * instant, once one exists) — touch a timed field at all. The owner's ruling: render **"nothing
 * recorded for N"** instead — the time since the MOST RECENT of any event this model actually
 * records for the person, whatever it was, named honestly.
 *
 * ⚠️ **THE CANDIDATE LIST BELOW IS WIDER THAN THIS TASK'S OWN BRIEF NAMED, AND THAT WIDENING IS
 * VERIFIED AGAINST THE FIXTURE, NOT SPECULATED.** The brief named six candidate sources plus the
 * `openedAt` floor. Two of the six do not exist on this model as named — see the two corrections
 * below — and three real recorded events the brief never mentioned turned out to be populated in
 * `ward-movements.ts` and would otherwise have been silently skipped, reproducing the exact "26h
 * stuck" failure this function exists to close, only smaller: `examination.at` (`WF-003` carries
 * one 200 minutes more recent than its `openedAt`), `closure.at` (several closed movements carry
 * one), and `referralAbsence.at` (`WF-001` carries one). All three are now included.
 *
 * **The two corrections against the brief's own wording:**
 *   - *"any transport instant"* — `TransportJob` (ward-model.ts) has five: `acceptedAt`,
 *     `enRouteAt`, `collectedAt`, `arrivedAt`, `cancelledAt`. Every one that is present is a
 *     candidate; there is no single "the" transport instant.
 *   - *"the legal form's recorded instant"* — `LegalForm` (the `movement.legalForm` object) carries
 *     only `code`, `kind` and `dueAt`, and `dueAt` is a future DEADLINE, not a past recorded event —
 *     using it here would report a delay as "active" ahead of the very moment it happens. The
 *     actual recorded instant of when a legal form was raised lives one level up, directly on
 *     `Movement.formedAt` ("When the referral for examination was made").
 *
 * ⚠️ **TIE-BREAK, AND IT IS DELIBERATE RATHER THAN INCIDENTAL.** The Ward Flow test clock does not
 * advance on its own (`ward-flow-tests-share-one-instant` — every seeded event can share one
 * `at`), so two candidates landing on the identical instant is not a corner case here, it is the
 * common case. `pickLatest` below keeps the FIRST candidate in the list on an exact tie (`>`, never
 * `>=`) — declines rank first in the list and the `openedAt` floor ranks last, so a decline beats a
 * same-instant closure and everything beats the floor. The choice of which name wins a tie is
 * otherwise arbitrary; determinism is the only property being bought.
 *
 * ⚠️ **`undefined` IS IN THE RETURN TYPE AND IS STRUCTURALLY UNREACHABLE FOR ANY REAL `Movement`.**
 * `openedAt` is a required field, never optional, so the floor candidate is always present and
 * `pickLatest` always has at least one entry to return. The union is kept because that is the
 * signature this task specifies, and because a `Movement` built by hand outside this codebase's own
 * constructors could theoretically omit it — but every movement this repository can actually
 * produce gets a defined answer. `tests/ward-delays-derivations.test.ts` proves this rather than
 * assuming it: a movement with every optional field absent still returns the floor.
 */
function pickLatest(candidates: readonly { at: Instant; what: string }[]): { at: Instant; what: string } {
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (candidate.at > best.at) best = candidate;
  }
  return best;
}

export function lastRecordedActivity(movement: Movement, now: Instant): { at: Instant; what: string } | undefined {
  const candidates: { at: Instant; what: string }[] = [];

  for (const decline of movement.declines) {
    candidates.push({ at: decline.at, what: "a ward declined" });
  }
  if (movement.escalation !== undefined) {
    /*
     * 🔴 **THIS SAID "escalated to the on-call manager" AND THAT PERSON DOES NOT EXIST.** Caught in
     * a browser on 2026-09-07, on the first load of the screen this figure was built for: the
     * detail panel read *"the last thing recorded was escalated to the on-call manager"* while the
     * row two inches to its left read *"Escalated 3m ago to State bed coordination desk"*. **Two
     * statements about one escalation, on one screen, naming two different parties.**
     *
     * ⚠️ **THE INVENTED NAME WAS NOT EVEN AVAILABLE TO INVENT.** `escalation.contact` is one of the
     * six members of `ESCALATION_CONTACTS` (`ward-change-reasons.ts`), a closed list whose values
     * ARE the rendered text — there is no separate label map and no free-text path, so "the on-call
     * manager" is a string this model cannot hold. A coordinator ringing the person this sentence
     * named would be ringing somebody nobody had escalated to.
     *
     * ⚠️ **AND IT WAS INVISIBLE TO EVERY GATE, INCLUDING THE ONES WRITTEN FOR IT.** The phrase is a
     * hard-coded literal, so the tests over this function asserted the literal back and passed; a
     * typecheck cannot object to a correct string; and the screen renders whatever it is handed.
     * The only thing that could catch it was reading the two sentences side by side on the page.
     */
    candidates.push({ at: movement.escalation.at, what: `escalated to ${movement.escalation.contact}` });
  }
  for (const withdrawal of movement.withdrawnReferrals) {
    candidates.push({ at: withdrawal.at, what: "a referral was withdrawn" });
  }
  const transport = movement.transport;
  if (transport?.cancelledAt !== undefined)
    candidates.push({ at: transport.cancelledAt, what: "transport was cancelled" });
  if (transport?.arrivedAt !== undefined) candidates.push({ at: transport.arrivedAt, what: "transport arrived" });
  if (transport?.collectedAt !== undefined)
    candidates.push({ at: transport.collectedAt, what: "the patient was collected" });
  if (transport?.enRouteAt !== undefined) candidates.push({ at: transport.enRouteAt, what: "transport left en route" });
  if (transport?.acceptedAt !== undefined)
    candidates.push({ at: transport.acceptedAt, what: "transport accepted the job" });
  if (movement.referredAt !== undefined) {
    candidates.push({ at: movement.referredAt, what: "referral raised" });
  }
  if (movement.formedAt !== undefined) {
    candidates.push({ at: movement.formedAt, what: "the legal form was raised" });
  }
  if (movement.examination !== undefined) {
    candidates.push({ at: movement.examination.at, what: "the psychiatric examination was recorded" });
  }
  if (movement.closure !== undefined) {
    candidates.push({
      at: movement.closure.at,
      what: movement.closure.outcome === "arrived" ? "the patient arrived" : "the movement closed without an admission",
    });
  }
  if (movement.referralAbsence !== undefined) {
    candidates.push({
      at: movement.referralAbsence.at,
      what:
        movement.referralAbsence.reason === "none_raised"
          ? "recorded that nobody referred this person"
          : "recorded that nobody was asked which referral this came from",
    });
  }
  // ⚠️ `now` FILTERS RATHER THAN MEASURES. Every candidate above is a PAST event by construction —
  // this function reports absolute instants, not a duration, so the caller subtracts `now` itself
  // to get "nothing recorded for N" (the same division of labour `legalDeadlineMinutes` above uses
  // for its own figure). But a malformed or clock-skewed record could carry a timestamp AFTER the
  // instant being asked about, and reporting that as "the most recent recorded event" would be
  // worse than reporting nothing: a future-dated decline read as the latest activity would make a
  // person read as MORE recently attended to than they are. Known-future candidates are dropped
  // before the floor is added, never trusted silently.
  const known = candidates.filter((candidate) => candidate.at <= now);
  // The floor. `openedAt` is required, never optional, so this candidate always exists — see the
  // doc comment above for why that makes `undefined` unreachable rather than a real branch.
  known.push({ at: movement.openedAt, what: "the journey opened" });
  return pickLatest(known);
}

/**
 * How long the whole waiting population has waited. One bar, one meaning.
 *
 * 🔴 **OWNER RULING, 2026-09-08: THE BANDS ARE 8 AND 24 HOURS, AND THERE IS ONLY ONE SET OF THEM.**
 * Until that date this file carried TWO band functions with DIFFERENT boundaries — this one at
 * 4/12 hours, rendered by the Delays screen, and a `waitBands` at 8/24 that was fully written,
 * fully tested, and called by NOTHING but its own test. A third set, 6/24, sits in an unbuilt
 * patient-search drawing. The owner was shown all three and chose 8/24.
 *
 * ⚠️ **THE DUPLICATE WAS THE REAL HAZARD, NOT THE NUMBERS.** Two exported functions banding the
 * same measurement at different boundaries, one live and one dead, is an invitation to wire the
 * wrong one — and nothing would have gone red if somebody had. `waitBands` was deleted here rather
 * than left as a second opinion; its boundary-value test, the only test in this file that pinned
 * exact minutes, was moved onto THIS function, which had none. If a second banding is ever genuinely
 * needed for a different screen, give it a name that says which screen, and pin both.
 *
 * ⚠️ Counted from `openedAt`, which today equals arrival in the department because a journey can
 * only be raised where the patient already is. The owner ruled on 2026-09-04 that this clock starts
 * at ARRIVAL, not at referral. The moment a community team can raise a journey directly, `openedAt`
 * becomes a referral time and every figure here silently changes meaning — the fix is a separate
 * arrival instant, never a reinterpretation of `openedAt`, and it is not built yet.
 *
 * ⚠️ `WardBar` (ward-bar.tsx) THROWS on an all-zero total, on fewer than two segments, and on an
 * unlabelled one, so this always returns three present, labelled segments and is honest about
 * returning three zeroes when nobody is open. The CALLER, not this function, is where the all-zero
 * case must be caught — a caller rendering a `WardBar` straight over that return crashes the page
 * on the best day the screen can have. See `tests/ward-bar-zero-is-reachable.test.ts`.
 *
 * Ascending, mildest first.
 */
export function waitingSplit(movements: Movement[], now: Instant): WardBarSegment[] {
  const open = movements.filter(isOpen);
  const waited = (movement: Movement) => now - movement.openedAt;
  return [
    { label: "Under 8 hours", value: open.filter((movement) => waited(movement) < 8 * 60).length, tone: "good" },
    {
      label: "8 to 24 hours",
      value: open.filter((movement) => waited(movement) >= 8 * 60 && waited(movement) < LONG_WAIT_MINUTES).length,
      tone: "warning",
    },
    // Neutral: plain grey (Josh's card choice, D-24 item 5). Whether a 24-hour wait is a limit is for
    // Josh to rule, not this bucket — it only describes recorded waits, so it carries no
    // danger/warning colour of its own.
    {
      label: "Over 24 hours",
      value: open.filter((movement) => waited(movement) >= LONG_WAIT_MINUTES).length,
      tone: "rest",
    },
  ];
}

/**
 * MEDICAL CLEARANCE — A MARKER ON THE PERSON, NEVER A COMPETING CAUSE. Owner ruling recorded on
 * this task's brief: the nine `DelayCause`s are stages of one journey (an answer, then a bed, then
 * a vehicle); clearance runs ALONGSIDE that journey, not as a rung on its ladder, so a person can be
 * `awaiting_bed_ready` AND uncleared at once, and both facts must show. `delayGroups` above must
 * therefore never gain a tenth cause for this — these two functions are additive, read beside a
 * `DelayGroup`, never merged into its ranking.
 *
 * ⚠️ **THE FIELD LIVES ON `Referral`, NOT ON `Movement`, AND MOST MOVEMENTS HAVE NO REFERRAL AT
 * ALL.** `Referral.medicalClearance`'s own doc comment in ward-model.ts is explicit that nothing
 * joined the two when the field was added; `Movement.referralId` (owner ruling R-2026-09-04-D) is
 * that join today, but it is populated for exactly two of this fixture's twenty hand-authored
 * movements (`WF-002`→`RF-012`, `WF-009`→`RF-013`) — "most movements have no referral" is the
 * documented ORDINARY case, not a fixture gap. `referralForMovement` (ward-derivations.ts) is the
 * one place that resolves the join; this does not invent a second one.
 *
 * ⚠️ **`undefined` MEANS UNKNOWN, NEVER "NOT CLEARED", AND `unclearedCount` MUST NOT COLLAPSE THE
 * TWO.** `TransportNeedState`'s own doc comment (ward-derivations.ts) names the exact defect this
 * avoids: "the reason the ED referral form's `specialling` checkbox was ordered fixed... an
 * unanswered question [read] as a decision." A movement with no resolvable referral, or one whose
 * referral has never had `RECORD_MEDICAL_CLEARANCE` run against it, is UNASSESSED — reported here
 * as `undefined` — and unassessed is not the same fact as a clinician having looked and said no.
 * `unclearedCount` counts only the strictly-`false` case for exactly that reason: today, with the
 * fixture carrying no `medicalClearance` at all on either linked referral, EVERY seeded movement's
 * `isCleared` reads `undefined` and `unclearedCount` is honestly `0` — not because nobody needs
 * clearing, but because nothing has recorded an answer either way. See the tests for the
 * constructed cases that exercise `true` and `false`, since the real fixture cannot.
 */
export function isCleared(movement: Movement, referrals: Referral[]): boolean | undefined {
  return referralForMovement(movement, referrals)?.medicalClearance?.cleared;
}

export function unclearedCount(movements: Movement[], referrals: Referral[]): number {
  return movements.filter(isOpen).filter((movement) => isCleared(movement, referrals) === false).length;
}

// The reminder marks and shift times are Josh's labelled defaults (D-22), named in one module.
const TWO_HOURS = SILENT_WARD_FIRST_REMINDER_MINUTES;
const FOUR_HOURS = SILENT_WARD_SECOND_REMINDER_MINUTES;
const MORNING_SHIFT_START = REMINDER_MORNING_SHIFT_START_MINUTE;
const MORNING_SHIFT_END = REMINDER_MORNING_SHIFT_END_MINUTE;
const firstMark = `${TWO_HOURS / 60} hours`;
const secondMark = `${FOUR_HOURS / 60} hours`;

/**
 * The named shift a referral sits in, and when that shift ends: the one shift pattern every screen
 * uses (`SHIFT_PATTERN`, Josh 26 Sept 2026), 07:00–15:00, 15:00–23:00 and 23:00–07:00. The night
 * shift crosses midnight. Nothing here writes state — it only names a clock face already implied
 * by `referredAt` / `raisedAt`.
 */
function shiftContaining(instant: Instant): { label: string; endsAt: Instant } {
  const startOfDay = dayOf(instant) * MINUTES_PER_DAY;
  const clock = minuteOfDay(instant);
  const clockFace = (minute: number) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  for (const shift of SHIFT_PATTERN) {
    const crossesMidnight = shift.endMinute <= shift.startMinute;
    const inside = crossesMidnight
      ? clock >= shift.startMinute || clock < shift.endMinute
      : clock >= shift.startMinute && clock < shift.endMinute;
    if (!inside) continue;
    const endsNextDay = crossesMidnight && clock >= shift.startMinute;
    return {
      label: `${clockFace(shift.startMinute)}–${clockFace(shift.endMinute)}`,
      endsAt: startOfDay + (endsNextDay ? MINUTES_PER_DAY : 0) + shift.endMinute,
    };
  }
  return { label: "07:00–15:00", endsAt: startOfDay + MORNING_SHIFT_END };
}

function nextMorningAtSeven(from: Instant): Instant {
  const startOfDay = dayOf(from) * MINUTES_PER_DAY;
  if (minuteOfDay(from) < MORNING_SHIFT_START) return startOfDay + MORNING_SHIFT_START;
  return startOfDay + MINUTES_PER_DAY + MORNING_SHIFT_START;
}

/**
 * Reminder copy for a ward that has not answered, derived only from `referredAt` and `now`.
 *
 * Returns `undefined` when there is no referral time, or when two hours have not yet passed.
 * The latest reached mark wins: 2 hours, then 4 hours, then the end of that shift.
 */
export function silentWardReminder(referredAt: Instant | undefined, now: Instant): string | undefined {
  if (referredAt === undefined) return undefined;
  const elapsed = now - referredAt;
  if (elapsed < TWO_HOURS) return undefined;
  const shift = shiftContaining(referredAt);
  const pastShiftEnd = now >= shift.endsAt;
  if (pastShiftEnd && elapsed >= FOUR_HOURS) {
    return `Ward silent past end of the ${shift.label} shift. Reminders were due at ${firstMark}, ${secondMark}, and end of shift (${OPERATIONAL_DEFAULT_LABEL}).`;
  }
  if (pastShiftEnd) {
    return `Ward silent past end of the ${shift.label} shift. A ${TWO_HOURS / 60}-hour reminder was due; ${secondMark} still ahead (${OPERATIONAL_DEFAULT_LABEL}).`;
  }
  if (elapsed >= FOUR_HOURS) {
    return `Ward silent ${secondMark}. Reminder due at ${firstMark} and ${secondMark}; end of that shift still ahead (${OPERATIONAL_DEFAULT_LABEL}).`;
  }
  return `Ward silent ${firstMark}. Reminder due; next at ${secondMark}, then the end of that shift (${OPERATIONAL_DEFAULT_LABEL}).`;
}

/**
 * Reminder copy for a community team that has not answered, derived only from `raisedAt` and `now`.
 *
 * First mark is 07:00 the next morning after the referral (or 07:00 the same day if it was raised
 * before then). Second mark is 07:00 the morning after that. Nothing before the first 07:00.
 */
export function silentCommunityReminder(raisedAt: Instant | undefined, now: Instant): string | undefined {
  if (raisedAt === undefined) return undefined;
  const firstMorning = nextMorningAtSeven(raisedAt);
  const morningAfter = firstMorning + MINUTES_PER_DAY;
  if (now >= morningAfter) {
    return "Community silent since the morning after. Reminders were due next morning, then the morning after.";
  }
  if (now >= firstMorning) {
    return "Community silent since next morning. Reminder due; the morning after still ahead.";
  }
  return undefined;
}

/**
 * The one reminder line a delays row may show. Community wins when a linked community destination
 * is still awaiting an answer; otherwise a silent referred ward. Absent timestamps stay silent.
 */
export function answerSilenceReminder(movement: Movement, referrals: Referral[], now: Instant): string | undefined {
  const referral = referralForMovement(movement, referrals);
  const silentCommunity = referral?.destinations.find(
    (addressing) => addressing.destination.kind === "community_team" && isAwaitingAnswer(addressing),
  );
  if (silentCommunity !== undefined && referral !== undefined) {
    return silentCommunityReminder(referral.raisedAt, now);
  }
  if (movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0) {
    return silentWardReminder(movement.referredAt, now);
  }
  return undefined;
}
