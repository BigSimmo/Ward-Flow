import type { WardChipLevel } from "@/components/ward-management/ward-chip";
import { clockState, minutesUntil, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { elapsedLabel, isOpen } from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { LegalForm, Movement } from "@/components/ward-management/ward-model";
import type { WardRecordTone } from "@/components/ward-management/ward-record-row";

/**
 * LEGAL FORMS AND DEADLINES — pure derivations for `LegalFormsScreen`.
 *
 * The screen renders these and nothing else; it computes no populations, no sort order and no
 * wording of its own, the same discipline `movements-screen.tsx`'s own header comment asks of
 * itself ("THE SCREEN COMPUTES NOTHING BEYOND PRESENTATION").
 *
 * 🔴 **CORRECTED 2026-09-17, T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`)
 * — THE CLAIM THAT 1A, 3B AND 3D "NEVER" CARRY A `dueAt` IS NOW FALSE.** Struck in place rather
 * than deleted, because the reading that made it true is what a reader will otherwise re-derive.
 * Until this date `ward-model.ts`'s `LegalForm.dueAt` really was permanently absent on a Form 1A
 * or 3B by owner instruction (2026-08-23), and a Form 3D carried no classification to hang one on
 * at all. Owner answer 1, 2026-09-17: the clinician now types the expiry written on whichever
 * form they hold, of any code — so every function below reads `movement.legalForm?.dueAt` exactly
 * as it always has, and that read is now the WHOLE of the distinction: **`legalFormGroupOf`
 * (below) already grouped by the RECORD, never by the form's code or `kind`** — a design choice
 * made and tested (`tests/ward-legal-forms-derivations.test.ts`'s "the group split reads the
 * record, never the form code") specifically so the day a 1A gained a real `dueAt` this module
 * would not need to change. That day is this one, and this module did not need to change either —
 * only this comment, which used to describe an absence as structural when it is now simply
 * whatever a clinician has, or has not yet, typed.
 *
 * `legalFormHasClockConcept` below still answers a narrower, still-true question — whether a
 * form's `kind` is one this fixture's data has historically populated a `dueAt` for (transport and
 * transfer orders) — and is read only by `legalFormRowClassification`'s own "unrecorded gap"
 * warning chip, never by the group split. It is not, and was never meant to be read as, a claim
 * about which forms MAY carry a typed expiry: any of them may.
 *
 * ⚠️ **NEVER INVENT A NUMBER.** Nothing here computes a `dueAt` for a form that lacks one —
 * every function below either reads a real `dueAt` off the model or states its absence in words.
 */

/** Every open movement that carries a legal form. A voluntary movement carries none and is not
 *  part of this population — see the scope sentence the screen renders beside it. */
export function legalFormPopulation(movements: Movement[]): Movement[] {
  return movements.filter(isOpen).filter((movement) => movement.legalForm !== undefined);
}

/**
 * Whether this form's KIND is one this fixture's data has historically populated a real `dueAt`
 * for — transport and transfer orders, seeded with illustrative deadlines from the start. `kind`
 * is `"examination" | "detention" | "transport" | "transfer" | undefined` (`ward-model.ts`).
 *
 * 🔴 **CORRECTED 2026-09-17, T2 — NOT A CLAIM ABOUT WHICH FORMS MAY CARRY ONE.** Until this date
 * only `"transport"`/`"transfer"` forms could acquire a `dueAt` at all, so this function doubled
 * as that gate. Owner answer 1, 2026-09-17: any form may now carry a clinician-typed expiry, so
 * this is read only by `legalFormRowClassification`'s "unrecorded gap" warning chip — a screen
 * nicety distinguishing a 4A/4C that usually HAS a recorded expiry in the data and happens not to,
 * from every other row — never by `legalFormGroupOf`, which grouped by the RECORD before this date
 * and still does.
 *
 * ⚠️ **LEFT AS-IS BY THE T2r FIX ROUND (2026-09-17, finding 12) — PENDING A FOLLOW-UP, NOT
 * SETTLED.** Now that any form may carry a typed expiry, this "unrecorded gap" chip's own premise
 * (a 4A/4C is the kind that USUALLY has one recorded) may no longer be the right thing to single
 * out — a 1A or 3D with no typed expiry could deserve the same visible chip. That is a design
 * question under owner answer 1, not a defect in this function, and it is recorded here rather
 * than decided unilaterally: whoever picks this up next should ask whether the gap chip belongs
 * on every code an expiry could exist for, or stays scoped to the two the fixture happens to seed.
 */
export function legalFormHasClockConcept(legalForm: LegalForm): boolean {
  return legalForm.kind === "transport" || legalForm.kind === "transfer";
}

/**
 * 🔴 THE TWO GROUPS, AND THIS REPLACES ORDERING THE TWO KINDS AGAINST EACH OTHER.
 *
 * `legalFormOrdered` below gives a form with no `dueAt` the sort key `Infinity`, so it lands last
 * on a list whose stated order is time remaining — and a 1A or 3B with no expiry typed against it
 * yet can be among the most legally consequential rows on the screen. ⚠️ **A missing sort key
 * landing at either end of an urgency-ordered list is wrong, and both ends look fine.**
 *
 * ✅ **So the two kinds are never ordered against each other.** Each group is ordered by a quantity
 * it actually has, and the distinction becomes STRUCTURAL rather than a sentence — nothing has to
 * claim a form type can never carry a deadline, which is a claim the model does not support.
 *
 * 🔴 **THE GROUP IS DECIDED BY WHAT THE RECORD HOLDS, NEVER BY THE FORM CODE.** Keying on the code
 * would hide a genuine legal deadline the day a record carries one against expectation — and it is
 * untestable against today's fixture, where the two readings agree on every row that exists. See
 * the constructed specimen in `tests/ward-legal-forms-derivations.test.ts`.
 */
export type LegalFormGroup = "with-deadline" | "no-deadline";

export function legalFormGroupOf(movement: Movement): LegalFormGroup {
  return movement.legalForm?.dueAt === undefined ? "no-deadline" : "with-deadline";
}

/**
 * One group's rows, ordered within it: by time remaining where there is one, otherwise by the
 * longest wait — `openedAt`, a real figure, rather than a sentinel standing in for a time nobody
 * recorded.
 */
export function legalFormGroupRows(movements: Movement[], now: Instant, group: LegalFormGroup): Movement[] {
  const rows = legalFormPopulation(movements).filter((movement) => legalFormGroupOf(movement) === group);
  if (group === "with-deadline") {
    return rows.sort((a, b) => minutesUntil(a.legalForm!.dueAt!, now) - minutesUntil(b.legalForm!.dueAt!, now));
  }
  return rows.sort((a, b) => a.openedAt - b.openedAt);
}

/** A real, passed deadline — never true for a form with no `dueAt`, matching the canonical breach
 *  predicate already used by `ward-pressure.ts` and `ward-derivations.ts`'s inbox builder:
 *  `dueAt !== undefined && clockState(dueAt, now) === "breached"`. Not re-derived differently here. */
export function isLegalDeadlineBreached(movement: Movement, now: Instant): boolean {
  const dueAt = movement.legalForm?.dueAt;
  return dueAt !== undefined && clockState(dueAt, now) === "breached";
}

/**
 * The screen's own sort key: a passed deadline sorts first (the most overdue first, since it is
 * the most negative), a coming deadline sorts next (soonest first), and a form with no `dueAt`
 * sorts last of all, carrying `Infinity`. Matches the approved drawing's own `legalSortKey`
 * (`docs/ward-flow/mockups/legal-forms-third-edition.html`, lines 8581-8599), which the drawing's
 * own comment traces to Command's tie-break for its priority queue ("Deadlines passed, then the
 * nearest deadline, then the longest wait").
 */
function legalSortKey(movement: Movement, now: Instant): number {
  const dueAt = movement.legalForm?.dueAt;
  return dueAt === undefined ? Infinity : minutesUntil(dueAt, now);
}

/** How long a movement has been open, in minutes — the tie-break for rows that share a sort key
 *  (typically: several forms with no deadline recorded, tied at `Infinity`). Longer waits sort
 *  first, matching the drawing's own tie-break. */
function waitedMinutes(movement: Movement, now: Instant): number {
  return now - movement.openedAt;
}

/** `legalFormPopulation`, ordered by `legalSortKey` then by longest wait. */
export function legalFormOrdered(movements: Movement[], now: Instant): Movement[] {
  return legalFormPopulation(movements)
    .slice()
    .sort((a, b) => {
      const ka = legalSortKey(a, now);
      const kb = legalSortKey(b, now);
      if (ka !== kb) return ka - kb;
      return waitedMinutes(b, now) - waitedMinutes(a, now);
    });
}

/**
 * The deadline sentence for one row — THREE wordings, never blended into one, because the fact
 * behind each is different:
 *
 *   - A real `dueAt`: states the real figure, passed or upcoming.
 *   - No deadline on the record — of ANY form, since owner answer 1, 2026-09-17: a clinician who
 *     has not yet typed an expiry against a 1A, 3B or 3D reads exactly the same as one who has not
 *     typed one against a 4A or 4C: "No deadline recorded" — the exact phrase
 *     `shortlist-panel.tsx`'s `legalFormLine` uses for the same fact, always paired with the real
 *     elapsed ED time so it cannot be misread as a statutory countdown (that file's own doc
 *     comment: *"the wording is deliberately 'no deadline recorded', not 'no statutory
 *     deadline'... asserting an absence is the same overreach as asserting [a] deleted figure"*).
 *     Never rendered bare — see this module's own header and the build contract's §5.
 *   - A clock-bearing form (4A / 4C) with no `dueAt` recorded (case 2 above): a DIFFERENT sentence,
 *     because collapsing it into the wording above would hide the one fact that makes it worth a
 *     second look — this form type is not usually silent on its deadline.
 *
 * Throws for a movement with no legal form at all: every caller reaches this only through
 * `legalFormPopulation`/`legalFormOrdered`, which already filter to movements that carry one, so a
 * call here with none is a caller error, not a state this screen can honestly render.
 */
export function legalDeadlineText(movement: Movement, now: Instant): string {
  const legalForm = movement.legalForm;
  if (!legalForm) {
    throw new Error(`legalDeadlineText called on movement ${movement.id}, which carries no legal form`);
  }
  if (legalForm.dueAt !== undefined) {
    const remaining = minutesUntil(legalForm.dueAt, now);
    return remaining < 0
      ? `Form expiry passed ${splitDuration(Math.abs(remaining))} ago`
      : `Form expires in ${splitDuration(remaining)}`;
  }
  /*
   * 🔴 ONE WORDING FOR AN ABSENT DEADLINE, NOT TWO — Ward Lead's ruling, 2026-09-12.
   *
   * This used to carry a second sentence for a clock-bearing form (4A/4C) whose `dueAt` was merely
   * unrecorded: *"…even though this form type is usually given one"*. ⚠️ **That asserts what a form
   * type USUALLY gets, which is a statutory-adjacent claim this prototype does not make elsewhere —
   * and its branch is unreachable on today's seed, where every 4A and 4C carries a real deadline.**
   * So it bought nothing today and carried a claim. The grouping now makes the distinction that
   * sentence was reaching for, without asserting anything.
   */
  return `No deadline recorded; ${elapsedLabel(movement, now)} in the emergency department`;
}

export type LegalFormBreakdownRow = {
  code: string;
  name: string;
  openCount: number;
  breachedCount: number;
};

/**
 * The forms present in `rows`, first-seen order (so a breach still leads the breakdown, since it
 * leads the list `rows` came from), each with its own open count and, only where true, how many
 * have passed their deadline. A plain count of what the caller is already showing — never a rate,
 * never a share, and never summed independently of the rows it describes (the "cannot disagree
 * structurally" shape the build contract's §6 asks for).
 */
export function legalFormBreakdown(rows: Movement[], now: Instant): LegalFormBreakdownRow[] {
  const order: string[] = [];
  const byCode = new Map<string, LegalFormBreakdownRow>();
  for (const movement of rows) {
    const legalForm = movement.legalForm;
    if (!legalForm) continue;
    let entry = byCode.get(legalForm.code);
    if (!entry) {
      entry = { code: legalForm.code, name: legalFormName(legalForm), openCount: 0, breachedCount: 0 };
      byCode.set(legalForm.code, entry);
      order.push(legalForm.code);
    }
    entry.openCount += 1;
    if (isLegalDeadlineBreached(movement, now)) entry.breachedCount += 1;
  }
  return order.map((code) => byCode.get(code)!);
}

export type LegalFormRowClassification = {
  tone: WardRecordTone;
  chip?: { level: WardChipLevel; text: string };
  reasonLevel: "danger" | "warning" | "ok";
};

/**
 * The one place a row's tone, chip and reason-level are decided — pulled out of the screen so the
 * three visibly-different-row shapes this build contract requires (breached / unrecorded gap /
 * everything else) are a pure function this test suite can drive with synthetic movements the
 * fixture does not (yet) contain, rather than something only reachable by rendering the screen.
 *
 * `WardRecordRow` throws on a toned row with no chip, so "everything else" is the only case that
 * may carry no chip, and it is also the only case whose tone is `"neutral"` — see that
 * component's own doc comment for why those two facts have to move together.
 */
export function legalFormRowClassification(movement: Movement, now: Instant): LegalFormRowClassification {
  const legalForm = movement.legalForm;
  if (!legalForm) {
    throw new Error(`legalFormRowClassification called on movement ${movement.id}, which carries no legal form`);
  }
  if (isLegalDeadlineBreached(movement, now)) {
    return { tone: "danger", chip: { level: "urgent", text: "Form expiry passed" }, reasonLevel: "danger" };
  }
  if (legalForm.dueAt === undefined && legalFormHasClockConcept(legalForm)) {
    /*
     * 🔴 THE CHIP SAYS WHAT THE RECORD HOLDS AND NOTHING ABOUT THE TYPE — Ward Lead's ruling,
     * 2026-09-12, correcting wording he had approved.
     *
     * It used to end with "for this form type". ⚠️ **This branch fires only for a 4A or 4C — the
     * two kinds that DO normally carry a deadline — so that phrasing asserted the opposite of the
     * truth about exactly the rows it appeared on.** The whole point of this row is that the type
     * has a clock and this RECORD does not.
     *
     * The distinction survives without the claim: the warning tone and the chip together make this
     * visibly a different row from a structurally clockless one, which is what "visibly a different
     * kind of row" asked for. The appearance carries it; the prose does not have to.
     */
    return {
      tone: "warning",
      chip: { level: "stalled", text: "No deadline recorded" },
      reasonLevel: "warning",
    };
  }
  return { tone: "neutral", reasonLevel: "ok" };
}
