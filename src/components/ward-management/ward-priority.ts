// src/components/ward-management/ward-priority.ts
import { clockState, minutesUntil, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  type Movement,
  type UrgencyLevel,
} from "@/components/ward-management/ward-model";

export type ScoreFactor = { label: string; points: number; detail: string };

/**
 * The label for the one operational-score factor that reports a legal form's recorded due time —
 * exported so `priority-queue.tsx` can find that factor BY THIS CONSTANT rather than by matching
 * the literal label text a second time in a second file. Two files agreeing on a string by
 * coincidence is exactly the shape that drifts the moment either wording changes alone; this is
 * the fix, not a second copy of the words.
 *
 * Renamed from "Statutory timing" — this prototype records what a form's due time is, never what
 * the Mental Health Act requires or when its authority lapses, so the label states the fact the
 * record actually holds.
 */
export const FORM_TIMING_FACTOR_LABEL = "Form due time";

/**
 * Urgency tier text carries its own direction wherever a tier is shown OR CHOSEN (Task 5
 * ruling 2). A bare "1", "2" or "3" tells a reader nothing about which end of the scale it is:
 * tier 1 is the clinician's most urgent judgement, tier 3 the least, and neither the digit nor
 * its ordering is self-evident to someone meeting the scale for the first time.
 *
 * This lives here, beside `queueOrder`, because `ward-priority.ts` already owns tier semantics
 * and carries the product owner's 2026-08-24 provenance for the three tiers (see
 * `operationalScore` below). It is deliberately NOT in `ward-model.ts`: an exported declaration
 * writing a number down there must be entered on `MODEL_CONSTANT_PROVENANCE`
 * (`tests/ward-legal-figure-guard.test.ts` Part 2), and these are display words for tiers that
 * already have their provenance recorded, not a new figure.
 *
 * Phase 7 Task 8 found the third consumer disagreeing with the other two: `priority-queue.tsx`
 * and `referral-board.tsx` each held their own identical copy and rendered "Tier 2 · urgent",
 * while the intake form (`referral-intake.tsx`, since retired) — the ONE screen where a human picks the value, on a phone, from a
 * source that may be a police car — rendered a bare "2". Two screens describing one field with
 * different words is this project's most expensive defect class, so the copies were replaced by
 * this single export rather than a third being added.
 *
 * These are TIER LABELS: three ordered categories, never a duration, quantity or statutory
 * figure of any kind.
 */
const TIER_QUALIFIER: Record<UrgencyLevel, string> = {
  1: "most urgent",
  2: "urgent",
  3: "least urgent",
};

/**
 * The one spelling of a tier, for every REFERRAL screen that shows or offers one — the intake
 * picker, the referral board and the match view.
 *
 * Narrowed from "every screen that shows or offers one" (review finding M4), which was not true.
 *
 * **The three deferred `<select>`s adopted this helper at `98a1a7c5f` — this paragraph used to say
 * they rendered a bare `{option}`, and that is no longer the case.** They were the two urgency
 * selects in `ed-screen.tsx` and the one in `shortlist-panel.tsx`: the exact case this export's own
 * rationale singles out, **a screen where a human CHOOSES the value.** Deferring them was wrong for
 * longer than it looked — a naked `1 2 3` says nothing about which end is urgent, the ED form
 * defaults to `3`, and urgency now outranks everything in the queue, so a clinician reading a bigger
 * number as more urgent filed the sickest patient last.
 *
 * ⚠️ **This paragraph also claimed all four surfaces "carry their own pinned tests". They did not.**
 * No test anywhere referenced `ward-change-urgency`, so both change pickers had NO coverage at all —
 * the deferral rested on a safety net that was never there, and nothing could have told anyone,
 * because a control no test names cannot fail one.
 *
 * **What remains true: `shortlist-panel.tsx` renders `Tier {movement.urgency}` as a badge**, dropping
 * the qualifier the boards show. It is now the only ward surface not reading this helper. Left
 * deliberately — a badge has a width, so whether the qualifier fits is a display decision rather
 * than a correctness one, and it is not the case this export's rationale singles out: **nobody
 * chooses a value from a badge.**
 */
export function urgencyTierLabel(urgency: UrgencyLevel): string {
  return `Tier ${urgency} · ${TIER_QUALIFIER[urgency]}`;
}

/**
 * Whether `movement.blocker` names something actually holding the movement up.
 *
 * ⚠️ **THIS WAS A PATTERN AND IS NOW A CLOSED SET, AND THE CHANGE REPAIRS A REAL DEFECT.** It used
 * to match the literal `"No blocker"` plus a regex for `"None"` followed by a dash or colon —
 * both CASE-SENSITIVE. That held while the only writers were the fixture and the reducer, which
 * write from a fixed vocabulary. `RECORD_MOVEMENT_BLOCKER` (2026-09-01) then let a person type any
 * non-blank prose, and the halves stopped matching: `"none — resolved"`, `"no blocker"`,
 * `"Nothing outstanding"`, `"N/A"` and `"Cleared"` all scored TEN POINTS as an active obstruction
 * on a movement nobody was holding up, pushing it up the queue with nothing red anywhere.
 *
 * The remedy is not a wider pattern — chasing phrasings is unbounded, and `/^none/i` would swallow
 * `"None of the secure units can take him"`, a REAL blocker this file's own test pins. Clearing has
 * its own event instead (`CLEAR_MOVEMENT_BLOCKER`), so this only ever has to recognise the
 * reducer's own sentinels plus the two legacy fixture values — see
 * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` in ward-model.ts for the full account, including the
 * consequence that typed prose is always treated as an obstruction.
 *
 * Trimmed before comparison for the same reason the reducer trims before storing: whitespace must
 * never be the difference between blocked and not.
 */
function hasActiveBlocker(blocker: string): boolean {
  const trimmed = blocker.trim();
  if (trimmed.length === 0) return false;
  return !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === trimmed);
}

/**
 * How badly this movement is going — an operations question, not a clinical one.
 *
 * Deliberately blind to `movement.urgency`. Urgency is the clinician's judgement and orders the
 * queue on its own; folding it in here produced a number labelled "not clinical severity" that
 * partly was, which is why the previous score was deleted rather than migrated.
 *
 * Also deliberately blind to `movement.examination`. Whether a patient has been reviewed does not
 * score here at all: on the product owner's 2026-08-24 instruction, priority is urgency and
 * waiting time alone, and being unreviewed neither costs points nor blocks a bed request. The
 * examination record itself is untouched — it is still captured and still displayed; it simply has
 * no effect on the queue. Do not reintroduce it here in any weight, and do not substitute a proxy.
 */
export function operationalScore(movement: Movement, now: Instant): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];

  const waitedMinutes = Math.max(0, now - movement.openedAt);
  const waitPoints = Math.min(40, Math.floor(waitedMinutes / 15));
  if (waitPoints > 0) {
    factors.push({
      label: "Time waiting",
      points: waitPoints,
      // "in ED", not "since the placement request" — the same figure, from the same field
      // (`now - movement.openedAt`), and `delays-screen.tsx`'s own ED clock states it in exactly
      // those words. `ward-model.ts`'s §7 access-target comment defines `openedAt` as "how long
      // the patient has been in the department"; "the placement request" names an event this
      // model does not claim that field is. See `tests/ward-priority.test.ts`'s own pin for why
      // both files' captions are tied together now.
      detail: `${splitDuration(waitedMinutes)} in ED`,
    });
  }

  // DORMANT FOR 1A/3B ONLY as of the 2026-08-23 product-owner correction: neither code carries
  // a `dueAt` any longer (see `LegalForm`'s own doc comment in ward-model.ts), so this block can
  // no longer award "Statutory timing" points on their account, and a patient referred for (or
  // awaiting) examination has their priority ride on "Time waiting" above alone — exactly the
  // clinician's own rule, with no compensating bonus for carrying a legal form, which would be
  // an unsupported clinical claim of the same kind this correction removes. This block is NOT
  // fully dormant, though: the transport/transfer forms (4A/4C) are out of scope for this
  // correction, still carry a real `dueAt`, and still legitimately score here today (e.g.
  // WF-006, WF-014 in the fixture, each "due in ≤90 min" at `NOW_ANCHOR`). The 1A/3B branch is
  // kept live, not deleted, on the same precedent Task 6A set for a Form 3B: a real examination
  // timeframe may be supplied later and should return as a derivation, not a rewritten function.
  const legalForm = movement.legalForm;
  if (legalForm?.dueAt !== undefined) {
    const dueAt = legalForm.dueAt;
    const state = clockState(dueAt, now);
    const points = state === "breached" ? 30 : state === "critical" ? 20 : state === "due" ? 10 : 0;
    if (points > 0) {
      const remaining = minutesUntil(dueAt, now);
      factors.push({
        label: FORM_TIMING_FACTOR_LABEL,
        points,
        detail:
          remaining < 0
            ? `Form ${legalForm.code} passed its deadline ${splitDuration(Math.abs(remaining))} ago`
            : `Form ${legalForm.code} due in ${splitDuration(remaining)}`,
      });
    }
  }

  if (movement.declines.length > 0) {
    const points = Math.min(15, movement.declines.length * 5);
    // `declines.length` is a cumulative historical count and `PARALLEL_REFERRAL_CAP` limits
    // simultaneous *live* referrals — they do not share a denominator (see the comment on
    // `buildActionInbox` in ward-derivations.ts), so state only the count, not a fraction.
    factors.push({
      label: "Destinations declined",
      points,
      detail: `${movement.declines.length} destination${movement.declines.length === 1 ? " has" : "s have"} declined`,
    });
  }

  if (hasActiveBlocker(movement.blocker)) {
    factors.push({ label: "Active blocker", points: 10, detail: movement.blocker });
  }

  if (
    movement.transport &&
    movement.transport.acceptedAt !== undefined &&
    movement.transport.enRouteAt === undefined &&
    movement.transport.collectedAt === undefined &&
    movement.transport.cancelledAt === undefined
  ) {
    factors.push({ label: "Transport delay", points: 5, detail: "Accepted but not yet collected" });
  }

  const score = Math.min(
    100,
    factors.reduce((sum, factor) => sum + factor.points, 0),
  );
  return { score, factors };
}

/**
 * Whether this patient carries the URGENT FLAG — the one thing that outranks a tier and a wait.
 *
 * Owner, 2026-08-30: "in certain cases patients can be marked as urgent for many reasons which
 * outranks everything." See `Movement.flaggedUrgent` for the full ruling and for what he
 * deliberately deferred.
 */
export function isFlaggedUrgent(movement: Pick<Movement, "flaggedUrgent">): boolean {
  return movement.flaggedUrgent;
}

/**
 * How long this movement has waited, in minutes, with no ceiling.
 *
 * `operationalScore`'s own "Time waiting" factor stops at `Math.min(40, …)` — a ten-hour cap that
 * exists for that function's display purpose, scoring a factor breakdown a coordinator reads, not
 * for ordering a queue. `queueOrder` below needs the true duration: two patients waiting ten hours
 * and thirty hours must not tie, which a capped score cannot express (D9-1).
 */
function waitedMinutesUncapped(movement: Pick<Movement, "openedAt">, now: Instant): number {
  return Math.max(0, now - movement.openedAt);
}

/**
 * The flag leads; beneath it, urgency tier, then the longest wait inside a tier — item 37,
 * resolved 2026-09-17.
 *
 * ⚠️ **THIS USED TO BE THREE RANKINGS STACKED AS A DELIBERATE STAGE, NOT A DESIGN, AND THE
 * OWNER HAS NOW BUILT ON IT.** His original scoping — "For now just have a feature that flags the
 * patient. I will build on it later" — held the tie-break at `operationalScore`, a composite that
 * mixed wait, form timing, declines and a blocker, and capped the wait it did count at ten hours.
 * His fuller ruling, named as deferred at the time, was "a long wait always is prioritised…
 * otherwise go by time for the main level of urgency" — and that is now what this function does:
 * flag, then tier, then the wait itself, uncapped. `operationalScore` and its factor breakdown are
 * UNCHANGED and still render on the coordinator queue (`priority-queue.tsx`) as an explanation of
 * how badly a movement is going operationally — "The factors below explain a wait; they do not
 * order the queue" is now literally true, where before the score doubled as the ordering.
 *
 * ⚠️ **FORM DUE TIME NO LONGER ORDERS THE COMMAND QUEUE** — narrowed 2026-09-17 (review
 * fix-forward item 9) from a claim about "anyone", which this function cannot make: the
 * Movements board's own `byLongestWait` (`movements-derivations.ts`) is a DIFFERENT ordering for a
 * DIFFERENT screen, and it still reads `isExpiringLegalAuthority`. This is this task's answer to
 * the legal plan's own §5 question for the ONE queue item 37 owns: a legal form's recorded due
 * time was never meant to carry statutory weight in this prototype, and on the Command queue
 * (`priority-queue.tsx`) it now carries no ordering weight either. Legal status was never read
 * here and still is not — two patients on THIS queue differing only in legal status or form
 * timing rank identically, exactly as before.
 *
 * `tests/ward-priority.test.ts` keeps the earlier, deferred state in its own historical comments;
 * do not read that file's prose as describing current behaviour without checking the assertions
 * themselves.
 *
 * ⚠️ **AN ID TIE-BREAKER, FOR PARITY WITH THE MOVEMENTS BOARD** — review fix-forward item 9,
 * 2026-09-17. Without one, two movements tied on flag, tier and wait fell back to
 * `Array.prototype.sort`'s stability, which is deterministic in this runtime but undocumented as a
 * property of THIS function — a reader has no way to tell "deliberate" from "happens to work"
 * from the code alone. `byLongestWait` (`movements-derivations.ts`) already ends its own
 * comparator on `a.id < b.id`; this matches it rather than inventing a second convention.
 */
export function queueOrder(movements: Movement[], now: Instant): Movement[] {
  return movements
    .filter(isOpen)
    .sort(
      (a, b) =>
        Number(isFlaggedUrgent(b)) - Number(isFlaggedUrgent(a)) ||
        a.urgency - b.urgency ||
        waitedMinutesUncapped(b, now) - waitedMinutesUncapped(a, now) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}
