/**
 * Record-keeping derivations: a movement's timeline, the change audit and the effectiveness
 * figures. Split out of `ward-derivations.ts`, which re-exports everything here.
 */
import {
  type CancelTransportReason,
  type ReleasePullReason,
  changeReasonLabels,
} from "@/components/ward-management/ward-change-reasons";
import type { Instant } from "@/components/ward-management/ward-clock";
import { type Movement, type StepBackReason, stepBackReasonLabels } from "@/components/ward-management/ward-model";

/**
 * Task 9 (spec item 7): the governance board's audit of changes — every urgency change, legal
 * status change, pull release and transport cancellation across ALL movements, not one patient's
 * own timeline (`movementTimeline` in `ward-derivations.ts` stays scoped to a single movement; this is the
 * statewide counterpart). Newest first, so the most recent decision is the one a reviewer sees
 * without scrolling.
 *
 * ⚠️ **WIDENED FOR TASK 5'S STEP-BACK PAIR (2026-09-04): `"stage_corrected"` and
 * `"acceptance_withdrawn"` join the two `UnwindRecord` kinds already here.** They are the same
 * category of thing — a coordinator's own mutating decision, unwinding some earlier state — so
 * excluding them from this board's audit would be the false-by-omission twin of leaving a real
 * decision off it. The loop below already iterates every `movement.unwinds` entry regardless of
 * kind, so nothing there needed to change to pick them up; only this type did.
 */
export type ChangeAuditEntry = {
  at: Instant;
  movementId: string;
  kind:
    "urgency" | "legal_status" | "pull_released" | "transport_cancelled" | "stage_corrected" | "acceptance_withdrawn";
  by: string;
  detail: string;
};

export function changeAudit(movements: Movement[]): ChangeAuditEntry[] {
  const entries: ChangeAuditEntry[] = [];
  for (const movement of movements) {
    for (const change of movement.statusChanges) {
      entries.push({
        at: change.at,
        movementId: movement.id,
        kind: "legal_status",
        by: change.by,
        detail: `${change.from} → ${change.to} · ${changeReasonLabels[change.reason]}`,
      });
    }
    for (const change of movement.urgencyChanges) {
      entries.push({
        at: change.at,
        movementId: movement.id,
        kind: "urgency",
        by: change.by,
        detail: `Tier ${change.from} → Tier ${change.to} · ${changeReasonLabels[change.reason]}`,
      });
    }
    for (const unwind of movement.unwinds) {
      if (unwind.kind === "stage_corrected" || unwind.kind === "acceptance_withdrawn") {
        /*
         * ✅ **THE DEFERRAL RECORDED HERE IS CLOSED (2026-09-06), AND IT CLOSED BECAUSE THE LABEL
         * MAP IT WAS WAITING FOR NOW EXISTS.** This block used to render the FACT without the
         * specific reason — "Stage corrected", "Acceptance withdrawn" — because `STEP_BACK_REASONS`
         * had no label anywhere, and fabricating one here would have been a second place authoring
         * text for that list. That reasoning was right and is why nothing was invented in the
         * meantime.
         *
         * `stepBackReasonLabels` (`ward-model.ts`, beside the list itself) is now the one place.
         * The audit line therefore says WHY, the same way the two kinds below already do.
         *
         * ⚠️ **THE CAST IS NARROWER THAN THE ONE BELOW AND DELIBERATELY SO.** `UnwindRecord.reason`
         * is a plain `string` because four unwind kinds share one record shape across three
         * different fixed reason lists. The reducer writes a `StepBackReason` into exactly these
         * two kinds (`STEP_BACK_STAGE`, `WITHDRAW_ACCEPTANCE`) and rejects any reason outside
         * `STEP_BACK_REASONS` before writing — so this narrows back to a guarantee the reducer
         * already enforces rather than inventing one.
         *
         * ⚠️ **AND IT STILL NEVER RENDERS A RAW VALUE.** `?? unwind.reason` is NOT used as a
         * fallback: a lookup miss would print `the_patient_situation_changed` on a coordinator's
         * screen, which is the snake_case defect the label map exists to prevent AND leaks the
         * token the content-free guard bans from every label. A miss is impossible while the
         * `Record` is total and the reducer validates membership, and if both of those ever stop
         * being true the honest outcome is the fact without the reason — which is what this falls
         * back to.
         */
        // `RELEASE_AND_REOPEN_SEARCH` from `accepted_awaiting_bed` writes an "acceptance_withdrawn"
        // entry carrying a `ReleasePullReason`, so fall back to that label list before the bare fact.
        const stepBackLabel =
          (stepBackReasonLabels[unwind.reason as StepBackReason] as string | undefined) ??
          (unwind.kind === "acceptance_withdrawn"
            ? (changeReasonLabels[unwind.reason as ReleasePullReason] as string | undefined)
            : undefined);
        const fact = unwind.kind === "stage_corrected" ? "Stage corrected" : "Acceptance withdrawn";
        entries.push({
          at: unwind.at,
          movementId: movement.id,
          kind: unwind.kind,
          by: unwind.by,
          detail: stepBackLabel === undefined ? fact : `${fact} · ${stepBackLabel}`,
        });
        continue;
      }
      // `UnwindRecord.reason` is typed as a plain `string` on `Movement` (ward-model.ts) because
      // `RELEASE_PULL` and `CANCEL_TRANSPORT` share one record shape for two different fixed
      // reason lists. The reducer only ever writes a `ReleasePullReason` into a "pull_released"
      // entry and a `CancelTransportReason` into a "transport_cancelled" one (ward-flow-reducer.ts),
      // so this assertion narrows back to that guarantee rather than inventing one — it does not
      // widen what values can reach the screen. Never render `unwind.reason` unlabelled: that is
      // the raw snake_case defect this file's own doc comment on `changeReasonLabels` exists to
      // prevent.
      const reason = unwind.reason as ReleasePullReason | CancelTransportReason;
      entries.push({
        at: unwind.at,
        movementId: movement.id,
        kind: unwind.kind,
        by: unwind.by,
        detail: changeReasonLabels[reason],
      });
    }
  }
  return entries.sort((a, b) => b.at - a.at);
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Minutes from referral to a ward accepting, for one movement — `undefined` when that duration
 * cannot be recovered from this record.
 *
 * `Movement.acceptedAt` (added fix round 1, Task 9) is the direct, reliable source: it is
 * stamped by `ACCEPT_IN_PRINCIPLE` (ward-flow-reducer.ts) the instant a unit is accepted, for
 * every acceptance reached from now on. It is preferred whenever present. Before that field
 * existed, the only place an acceptance instant survived was `withdrawnReferrals` — the same
 * reducer branch withdraws every OTHER referred unit in the same update, stamping each
 * withdrawal with `event.now`, so a movement accepted while more than one unit held a live
 * referral leaves the acceptance instant behind as a side effect. That fallback still applies to
 * the hand-authored seed fixture (`ward-movements.ts`), which sets `acceptedUnitId` directly
 * rather than via a dispatched event and so never carries `acceptedAt` — its one recoverable
 * acceptance (WF-006) is only found this way, and the fixture is deliberately never backfilled
 * with an invented `acceptedAt` to manufacture a bigger sample. A movement accepted with only one
 * referred unit and no `acceptedAt` withdraws nothing and leaves no timestamp anywhere in this
 * model — that movement reached acceptance but genuinely has no recoverable "when", so it is
 * excluded here rather than guessed.
 */
function acceptanceDurationMinutes(movement: Movement): number | undefined {
  if (movement.acceptedUnitId === undefined) return undefined;
  if (movement.acceptedAt !== undefined) return movement.acceptedAt - movement.openedAt;
  if (movement.withdrawnReferrals.length === 0) return undefined;
  return movement.withdrawnReferrals[0].at - movement.openedAt;
}

/** Distinct units this movement has ever referred to: currently referred, declined, withdrawn on
 *  acceptance, and the accepted unit itself. `undefined` when the movement has never referred to
 *  any unit, so it never contributes a fabricated zero to an average. */
function unitsContactedCount(movement: Movement): number | undefined {
  const contacted = new Set<string>([
    ...movement.referredUnitIds,
    ...movement.declines.map((decline) => decline.unitId),
    ...movement.withdrawnReferrals.map((withdrawn) => withdrawn.unitId),
  ]);
  if (movement.acceptedUnitId !== undefined) contacted.add(movement.acceptedUnitId);
  return contacted.size === 0 ? undefined : contacted.size;
}

/**
 * Fix round 1 (Task 9): a computed figure alone is not honest without the basis it was drawn
 * from. `sampleSize` is how many movements actually contributed an observation; `population` is
 * how many movements COULD have — every acceptance for the acceptance measure, every movement
 * passed in for the units-contacted measure. A median or average over a small `sampleSize`
 * against a much larger `population` (this fixture: 1 of 27 acceptances) is a guess wearing the
 * clothes of a measurement unless that gap renders next to the number.
 */
export type EffectivenessMeasure = {
  value: number | undefined;
  sampleSize: number;
  population: number;
};

/**
 * The fewest observations a governance figure may be computed from before it is published.
 *
 * **RULED BY THE OWNER, 2026-08-30, first-hand: hide the governance median below FIVE cases.** It
 * was provisional until then — proposed by a session, recorded as provisional so it would be
 * findable rather than inherited — and he has now decided it.
 *
 * ⚠️ **IT IS A DISPLAY THRESHOLD AND NOT A CLINICAL ONE, AND HE AGREED ON THAT BASIS.** Five is a
 * convention borrowed from health reporting — the point at which a middle value stops describing
 * anything real. **It is not derived from this data and it is not a figure from anywhere else.**
 * That was said to him plainly before he agreed, and it is written here because it is exactly the
 * kind of number a later reader assumes was derived from something.
 *
 * Applied to BOTH measures, not only the median that prompted it. They are the same kind of claim,
 * rendered by the same component with the same basis line, and a floor on one alone would publish
 * an average of two beside a suppressed median of four.
 */
export const MINIMUM_EFFECTIVENESS_SAMPLE = 5;

/**
 * Task 9 (spec item 7), D7: the governance board's two live effectiveness numbers. Conservative
 * failure applies to each independently — a measure this cannot compute returns `undefined`,
 * never `0`, because zero minutes to acceptance or zero units contacted both read as a real
 * result rather than as "unknown". Both describe the current synthetic scenario only; nothing
 * here is a claim about the prototype's real-world effectiveness. Both carry their own basis
 * (`EffectivenessMeasure`) so a thin sample is never presented bare.
 *
 * ⚠️ **AND SINCE 2026-08-30 A THIN SAMPLE IS NOT PUBLISHED — BUT THAT DECISION IS NOT MADE HERE.**
 * Owner ruling: below `MINIMUM_EFFECTIVENESS_SAMPLE` a measure reads "Not enough data to compute"
 * rather than printing a figure. **This function keeps computing honestly and `EffectivenessValue`
 * decides what to publish**, because suppressing here would have gutted five unit tests that exist
 * to prove the median arithmetic and the `acceptedAt`-over-fallback preference — they feed it two
 * and three movements on purpose. A publishing rule enforced inside the calculation stops the
 * calculation being testable at the sizes it is interesting at. The board was publishing **"30 min — from 1 of 27 recorded acceptances"**, and the
 * argument he approved is that **the word *Median* means "a typical case" to a clinician, and no
 * caveat printed beside it undoes that** — on the one page whose entire purpose is being trusted
 * about its own limits.
 *
 * ⚠️ **THIS DOES NOT OVERTURN THE DISCLOSURE RULE AND THAT DISTINCTION WAS NEARLY LOST.**
 * `EffectivenessValue`'s comment says a thin sample "must say so in the same breath as the figure,
 * not in a tooltip or a footnote"; one session read its tail clause as saying SUPPRESS and nearly
 * put "your code disagrees with its own rule, shall I fix it?" to the owner — a framing that gets a
 * yes from anybody and would have deleted a repair somebody deliberately made. The clause attaches
 * to a median **rendered bare**. Disclosure stays: `sampleSize` and `population` survive
 * suppression, so the screen still says "from 1 of 27" beside the absence, which is what makes the
 * absence informative rather than merely blank. **This is a floor beneath the rule, not a
 * replacement for it.**
 */
export function effectivenessNumbers(movements: Movement[]): {
  medianMinutesToAcceptance: EffectivenessMeasure;
  averageUnitsContacted: EffectivenessMeasure;
} {
  const totalAcceptances = movements.filter((movement) => movement.acceptedUnitId !== undefined).length;
  const acceptanceDurations = movements
    .map((movement) => acceptanceDurationMinutes(movement))
    .filter((minutes): minutes is number => minutes !== undefined);

  const contactedCounts = movements
    .map((movement) => unitsContactedCount(movement))
    .filter((count): count is number => count !== undefined);

  const averageUnitsContacted =
    contactedCounts.length === 0
      ? undefined
      : contactedCounts.reduce((total, count) => total + count, 0) / contactedCounts.length;

  return {
    medianMinutesToAcceptance: {
      value: median(acceptanceDurations),
      sampleSize: acceptanceDurations.length,
      population: totalAcceptances,
    },
    averageUnitsContacted: {
      value: averageUnitsContacted,
      sampleSize: contactedCounts.length,
      population: movements.length,
    },
  };
}
