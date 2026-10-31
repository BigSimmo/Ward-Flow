// src/components/ward-management/ward-priority.ts
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import {
  clockState,
  type DueSoonThresholds,
  type Instant,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { typedTimePhrase } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { isOpen } from "@/components/ward-management/ward-derivations";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  type Movement,
  type UrgencyLevel,
} from "@/components/ward-management/ward-model";

/** One plain reason a wait is long. Audit 1, Josh 20 Oct (CS-05): no points and no total. */
export type WaitFactor = { label: string; detail: string };

/**
 * The label for the one wait factor that reports a legal form's recorded due time —
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
 * `waitFactors` below). It is deliberately NOT in `ward-model.ts`: an exported declaration
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
export const TIER_QUALIFIER: Record<UrgencyLevel, string> = {
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
 * `"Nothing outstanding"`, `"N/A"` and `"Cleared"` all counted as an active obstruction on a
 * movement nobody was holding up.
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
 * The plain reasons behind a wait, shown under "Why this wait". An operations question, not a
 * clinical one.
 *
 * Audit 1, Josh 20 Oct (CS-05): this used to be `operationalScore`, a 0 to 100 points total with
 * "+N" beside each reason. Staff could read points as severity (never-build item 1), so the points
 * and the total are gone; only the sentences remain. Nothing here orders any list.
 *
 * Deliberately blind to `movement.urgency` (the clinician's judgement) and to
 * `movement.examination` (owner, 2026-08-24: priority is urgency and waiting time alone). Do not
 * reintroduce either here, and do not substitute a proxy.
 */
export function waitFactors(movement: Movement, now: Instant, thresholds: DueSoonThresholds): WaitFactor[] {
  const factors: WaitFactor[] = [];

  const waitedMinutes = Math.max(0, now - movement.openedAt);
  if (waitedMinutes > 0) {
    factors.push({
      label: "Time waiting",
      // "in ED", not "since the placement request" — the same figure, from the same field
      // (`now - movement.openedAt`), and `delays-screen.tsx`'s own ED clock states it in exactly
      // those words. See `tests/ward-priority.test.ts`'s own pin.
      detail: `${splitDuration(waitedMinutes)} in ED`,
    });
  }

  // Only the transport/transfer forms (4A/4C) carry a person-recorded `dueAt` (see `LegalForm` in
  // ward-model.ts); 1A/3B never do. Reported only while that form remains in force
  // (`currentLegalDueAt`) and its recorded time is due, critical or passed.
  const legalForm = movement.legalForm;
  const dueAt = currentLegalDueAt(movement);
  if (legalForm && dueAt !== undefined && clockState(dueAt, now, thresholds) !== "clear") {
    // Legal times only as typed (31 Oct 2026): "Form 4C ends 15:42 as typed", never a count.
    factors.push({
      label: FORM_TIMING_FACTOR_LABEL,
      detail: `Form ${legalForm.code} ${typedTimePhrase(dueAt, now)}`,
    });
  }

  if (movement.declines.length > 0) {
    // `declines.length` is a cumulative historical count, not a fraction of live referrals.
    factors.push({
      label: "Destinations declined",
      detail: `${movement.declines.length} destination${movement.declines.length === 1 ? " has" : "s have"} declined`,
    });
  }

  if (hasActiveBlocker(movement.blocker)) {
    factors.push({ label: "Active blocker", detail: movement.blocker });
  }

  if (
    movement.transport &&
    movement.transport.acceptedAt !== undefined &&
    movement.transport.enRouteAt === undefined &&
    movement.transport.collectedAt === undefined &&
    movement.transport.cancelledAt === undefined
  ) {
    factors.push({ label: "Transport delay", detail: "Accepted but not yet collected" });
  }

  return factors;
}

/**
 * Whether this patient carries the URGENT FLAG. Owner, 2026-08-30: "in certain cases patients can
 * be marked as urgent for many reasons". See `Movement.flaggedUrgent` for the full ruling.
 *
 * Audit 1, Josh 20 Oct (CS-04): the flag is a highlight on the row. It no longer moves the row.
 */
export function isFlaggedUrgent(movement: Pick<Movement, "flaggedUrgent">): boolean {
  return movement.flaggedUrgent;
}

/**
 * The Home queue's one order: longest wait first (earliest `openedAt`), then the id so equal waits
 * never fall back on sort stability.
 *
 * Audit 1, Josh 20 Oct (CS-04, NB-6a), superseding D-32 of 12 Oct: re-sorting the waiting queue is
 * on the never-build list. The flag, an act-now task and the tier used to lift rows above longer
 * waits; they now stay visible on each row as badges and do not move it. Legal status and form
 * timing were never read here and still are not.
 */
export function queueOrder(movements: Movement[], now: Instant): Movement[] {
  void now; // Kept so existing callers compile; the order reads no clock.
  return movements.filter(isOpen).sort((a, b) => a.openedAt - b.openedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
