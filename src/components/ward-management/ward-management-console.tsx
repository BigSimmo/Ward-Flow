"use client";

import {
  ArrowLeft,
  BedSingle,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Search,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import Link from "next/link";

import { ContextualBackLink } from "@/components/contextual-back-link";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  clockState,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { MissingValue } from "@/components/ui/missing-value";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import {
  candidateReason,
  destinationNoLongerLawful,
  eligibleCandidatesAmong,
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  examinationRevokedWhileBedHeld,
  isOpen,
  movementHealthService,
  orphanedTransport,
  restrictionNotice,
  stageCopy,
  transportNeedState,
  transportStatusLabel,
} from "@/components/ward-management/ward-derivations";
import {
  CANCEL_TRANSPORT_REASONS,
  DIVERSION_REASONS,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
  URGENT_MARK_REASONS,
  changeReasonLabels,
  withdrawalReasonLabels,
  type CancelTransportReason,
  type DiversionReason,
  type StopTransportReason,
  type TransportWhereabouts,
  type UrgentMarkReason,
} from "@/components/ward-management/ward-change-reasons";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  MOVEMENT_STAGES,
  REFERRAL_GENDERS,
  STEP_BACK_REASONS,
  stepBackReasonLabels,
  type StepBackReason,
  type DeclineReason,
  type LegalForm,
  type Movement,
  type MovementStage,
  type MovementId,
  type ReferralGender,
  type Unit,
} from "@/components/ward-management/ward-model";
import { WardChip, type WardChipLevel } from "@/components/ward-management/ward-chip";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./ward-management.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";

/**
 * Task 10 (spec item 8). `changeReasonLabels` covers the four reason lists in
 * `ward-change-reasons.ts` but not `DeclineReason` — declines are a fifth, older fixed list
 * (`DECLINE_REASONS` in `ward-model.ts`) that predates that file. Same discipline: chosen, never
 * typed, operational and content-free, never a raw snake_case code on screen.
 */
/**
 * WHAT A STAGE TRANSITION'S REASON IS CALLED IN WORDS — across all five events that write one.
 *
 * 🔴 **THIS LINE PRINTED `the_bed_was_lost` ON A COORDINATOR'S SCREEN.** `StageChange.reason` is a
 * plain `string` because five events write it from FOUR different closed reason lists, and the
 * timeline rendered it raw — three lines above `statusChanges`, which looks its own reason up in
 * `changeReasonLabels` correctly, and directly below the file's own docblock complaining that
 * `declineReasonLabels` "sat unused twelve lines away in this very file". The same defect, the
 * same file, the same day it was written down.
 *
 * It was invisible until 2026-09-06 only because the one fixture path that reaches it needs a
 * control that did not exist. `DECLINE` and `RELEASE_PULL` reach it too.
 *
 * ⚠️ **NO TEXT IS AUTHORED HERE.** Every label comes from the map that already owns that list —
 * this resolves, it does not name. Authoring a fifth vocabulary would be the "two places for one
 * fact" this project forbids, and `tests/ward-console-timeline-reasons.test.ts` pins that every
 * reason the reducer can write is covered by one of these four.
 *
 * ⚠️ **A MISS RETURNS `undefined`, AND THE CALLER THEN PRINTS THE FACT WITHOUT THE REASON. Never
 * `?? reason`.** A fallback to the raw value is the defect this function exists to remove, and it
 * would reappear the moment a fifth list was added — silently, on the one screen that gets printed
 * into a review of a patient who came to harm.
 */
export function stageChangeReasonLabel(reason: string): string | undefined {
  /*
   * The three maps that between them own every reason list a stage transition can be written
   * with. `withdrawalReasonLabels` is deliberately NOT among them: no event writes a
   * `WithdrawalReason` into a `stageChange`, and its line renders that map directly under a
   * total `Record` the compiler checks. A map in this chain that nothing needs is one more way
   * for a shared key to resolve to the wrong list's wording — which
   * `tests/ward-console-timeline-reasons.test.ts` also checks cannot happen among these three.
   */
  const maps: Record<string, string>[] = [changeReasonLabels, declineReasonLabels, stepBackReasonLabels];
  for (const map of maps) {
    const label = map[reason];
    if (label !== undefined) return label;
  }
  return undefined;
}

export const declineReasonLabels: Record<DeclineReason, string> = {
  no_bed: "No bed available",
  sex_mix: "Sex mix",
  specialling_unavailable: "Specialling unavailable",
  acuity_mix: "Acuity mix",
  capability_mismatch: "Capability mismatch",
  bed_pulled_for_earlier_referral: "Bed pulled for earlier referral",
  out_of_catchment: "Out of catchment",
};

/**
 * The "label (code) · …" line for a legal form, shared by the readiness card and the legal
 * panel below. Neither a Form 1A nor a Form 3B carries a `dueAt` in this model (see `LegalForm`'s
 * own doc comment in ward-model.ts) — this states that absence explicitly rather than ever
 * formatting an undefined instant, which is how "due NaN:NaN" would ship.
 *
 * The wording is deliberately "no deadline recorded", not "no statutory deadline". It reports
 * what THIS RECORD holds, which is all we can verify. "No statutory deadline" asserts what the
 * Mental Health Act requires, and that is a legal claim this prototype is not entitled to make in
 * either direction — asserting an absence is the same overreach as asserting the seven-day figure
 * that was deleted on 2026-08-23.
 *
 * `formatInstantWithDay`, never `formatInstant`: a bare clock face discards the day, so a deadline
 * that has rolled past midnight prints unchanged and now reads as hours in the future rather than
 * hours overdue — observed on WF-004 (movement-workspace-review-2026-09-04.md, finding 3). A
 * breached deadline also says so in words, from `clockState`, because the wrong-day clock face is
 * exactly the kind of silent wrongness this line must not repeat with a silent breach.
 */
function legalFormReadinessLine(legalForm: LegalForm, now: Instant): string {
  // A code this model holds no label for — Form 3D — is named by its code alone, never by a
  // guessed expansion and never by the word "undefined".
  const named = legalFormNameLabelFirst(legalForm);
  if (legalForm.dueAt === undefined) return `${named} · no deadline recorded`;
  const when = formatInstantWithDay(legalForm.dueAt, now);
  if (clockState(legalForm.dueAt, now) === "breached") {
    return `${named} · due ${when} — ${formatRemaining(minutesUntil(legalForm.dueAt, now))}`;
  }
  return `${named} · due ${when}`;
}

const stageIcons = {
  placement_requested: FileCheck2,
  destination_review: Search,
  accepted_awaiting_bed: BedSingle,
  pulled: CalendarDays,
  handover_ready: ShieldCheck,
  moving: Truck,
  arrived: CheckCircle2,
} satisfies Record<MovementStage, LucideIcon>;

/**
 * WHEN THIS MOVEMENT REACHED A GIVEN STAGE, or `undefined` when nothing recorded it.
 *
 * ⚠️ `stageChanges` FIRST, ALWAYS. It is the only field that records a stage transition as such;
 * the per-stage fields below are the model's older, partial coverage of the same events and exist
 * for the stages `stageChanges` may not carry on a hand-authored fixture.
 *
 * ⚠️ FOUR OF THE SEVEN STAGES HAVE NO TIMESTAMP FIELD AT ALL — `pulled`, `handover_ready`, and
 * `destination_review`/`arrived` in some shapes. That is why this returns `undefined` rather than
 * substituting `openedAt` or `now`: a completed step whose time nobody recorded says so in words
 * on screen. A guessed instant would be indistinguishable from a recorded one.
 */
/**
 * Exported ONLY so `tests/ward-stage-reached-at.test.ts` can drive the real function.
 *
 * ⚠️ IT WAS PRIVATE, AND THE TEST MIRRORED IT — WHICH GUARDED NOTHING. A re-implementation
 * agrees with itself forever: reverting either decision below left every behavioural assertion
 * green, because they were exercising the copy. Measured, not assumed — the mutation caught only
 * the source-text pin. Exporting deletes the mirror and the whole class of drift with it.
 */
/**
 * WHAT TO SAY WHEN A MOVEMENT'S RECORDED ORIGIN DEPARTMENT CANNOT BE RESOLVED.
 *
 * ⚠️ IT NAMES THE ID, AND IT NEVER SAYS "NOT RECORDED". `Movement.originEdId` is a REQUIRED
 * `string`, so an origin id is always recorded; `allEmergencyDepartments().find(...)` returns
 * `undefined` only when that recorded id matches no department. Saying "no origin department is
 * recorded" therefore reports the wrong absence entirely — a lookup miss dressed as a missing
 * record — and sends whoever reads it to look for the wrong thing.
 *
 * The wording is not new. Five other surfaces already render exactly this sentence for exactly this
 * case (`escalation-board`, `handover-page`, `officer-screen`, `patient-search`, `live-tracker`).
 * This file was the sixth and said something else, in TWO places.
 *
 * ⚠️ AND THE SECOND PLACE IS THE POINT. One site was reported to me; the other was fifteen lines
 * from a row I had repaired earlier the same night in the same panel. **When you repair a row, read
 * the panel. When you repair a panel, read the page.** A function, rather than a sixth and seventh
 * copy of the string, is what makes the next site inherit this instead of re-earning it.
 */
/**
 * Which figures carry amber, and which urgent fact the ceiling withheld.
 *
 * 🔴 **EXTRACTED SO THE PROPERTY CAN BE TESTED OVER EVERY COMBINATION, not over whichever one the
 * fixture happens to produce.** While this lived inline it was reachable only through a patient who
 * met all three conditions at once, so the case it exists for — the sickest movement on the board —
 * was the single hardest case to construct and therefore the one nobody checked.
 *
 * ⚠️ **`WardFigureStrip` THROWS above two flagged tiles**, and that ceiling is deliberate: amber
 * means "look here" and directs the eye nowhere when everything carries it. So a third urgent fact
 * cannot be given amber. Before 2026-09-06 it was simply dropped and nothing said so, which made
 * the screen assert "these two are the urgent things" on the one patient for whom three were.
 *
 * ⚠️ **A REORDER IS NOT A FIX.** Whichever key sorts third still vanishes; only the identity of the
 * vanished fact changes. What this returns instead is the withheld fact BY NAME, for the caller to
 * state in words — the ceiling keeps deciding the colour and stops deciding what the reader is told.
 *
 * Order is the owner's ruling, 2026-09-06: a breached deadline, then the declines, and the expired
 * hold yields. A refusal is a fact a coordinator must act on; an expired hold is usually already
 * known to whoever let it expire.
 */
export const URGENT_FIGURE_FLAG_CEILING = 2;

export function urgentFigureFlags(conditions: { deadlineBreached: boolean; declined: boolean; pullExpired: boolean }): {
  flagged: Set<string>;
  withheldFlags: string[];
} {
  const labels: Record<string, string> = {
    deadline: "the passed deadline on the legal form",
    declines: "the wards that have declined",
    pull: "the hold on the bed, which has run out",
  };
  const urgent = [
    conditions.deadlineBreached ? "deadline" : undefined,
    conditions.declined ? "declines" : undefined,
    conditions.pullExpired ? "pull" : undefined,
  ].filter((key): key is string => key !== undefined);

  return {
    flagged: new Set(urgent.slice(0, URGENT_FIGURE_FLAG_CEILING)),
    withheldFlags: urgent.slice(URGENT_FIGURE_FLAG_CEILING).map((key) => labels[key] ?? key),
  };
}

/**
 * ⚠️ **The sentence comes from `ward-absence-labels.ts` — Ward Lead's 2026-09-11 ruling.** This
 * function used to spell it out, and `tests/ward-origin-department-absence.test.ts` pinned that
 * spelling as correct while describing it as the wording "five sibling surfaces render
 * independently". 🔴 **Five surfaces rendering one sentence independently is what made the ruling
 * un-appliable: no one of them could move without disagreeing with the other four.**
 *
 * **It takes no `name` argument because it never had one** — this helper is called where the lookup
 * has already failed, so the unresolved branch is the only branch.
 */
export function unresolvedOriginDepartment(movement: Movement): string {
  return departmentLabel(movement.originEdId, undefined);
}

export function stageReachedAt(movement: Movement, stage: MovementStage): Instant | undefined {
  /*
   * 🔴 `findLast`, NOT `find` — THE CURRENT VISIT, NOT THE FIRST ONE EVER.
   *
   * A movement can return to an earlier stage and reach it again: accept, withdraw the acceptance,
   * re-refer, re-accept. `find` returns the FIRST `accepted_awaiting_bed` transition, so the
   * current-step sentence dated the movement from the decision that was WITHDRAWN, while
   * `acceptedAt` beside it held the newer one. Two fields on one screen disagreeing, with the
   * older one presented as the current state.
   */
  const recorded = movement.stageChanges.findLast((change) => change.to === stage);
  if (recorded) return recorded.at;
  if (stage === "placement_requested") return movement.openedAt;
  if (stage === "destination_review") return movement.referredAt;
  if (stage === "accepted_awaiting_bed") return movement.acceptedAt;
  /*
   * 🔴 `collectedAt`, NOT `enRouteAt`. The reducer enters `moving` on `PATIENT_COLLECTED`
   * (ward-flow-reducer.ts case at 1584, `stage: "moving"` at 1595) — never on
   * `TRANSPORT_EN_ROUTE`, which leaves the movement at `handover_ready`. So `enRouteAt` is the
   * time the CREW set off, not the time the PATIENT began moving, and it is always the earlier of
   * the two.
   *
   * Measured on the seeded fixture: three movements carry both and all three differ —
   * WF-006 en route -15 / collected -7, WF-007 -25 / -10, WF-014 -10 / -4. The workspace was
   * claiming WF-006 had been moving for eight minutes longer than it had.
   *
   * No fallback to `enRouteAt`: a movement with transport en route but not collected has not
   * reached `moving` at all, so there is no time to report. `undefined` makes the screen say the
   * step's time was not recorded, which is true — and the doc comment above is explicit that a
   * guessed instant would be indistinguishable from a recorded one.
   */
  if (stage === "moving") return movement.transport?.collectedAt;
  if (stage === "arrived") {
    if (movement.transport?.arrivedAt !== undefined) return movement.transport.arrivedAt;
    return movement.closure?.outcome === "arrived" ? movement.closure.at : undefined;
  }
  return undefined;
}

export type StepState = "done" | "current" | "stopped" | "ahead";

/**
 * THE PROGRESS TRACK FOR ONE PATIENT — and the deletion that matters more than the addition.
 *
 * ⚠️ THIS USED TO RENDER `stageSummaries(movements)`: seven counts — 14/9/6/7/2/6/6 on the day it
 * was reviewed — every one of them a fact about OTHER PATIENTS, on one patient's own page, under a
 * heading that reads as this patient's progress. The call is gone, not reworded, and nothing on
 * this page reads the whole `movements` collection any more.
 *
 * ⚠️ AND IT USED TO BE SEVEN BUTTONS. Clicking a stage moved a local `useState` and nothing else —
 * a future step on somebody else's movement was clickable and did nothing. Steps are plain list
 * items now: this is a record of where a patient has got to, not a control.
 *
 * ⚠️ A CLOSED MOVEMENT HAS NO CURRENT STEP. Observed 2026-09-04: the closure banner said the
 * movement was over while step 3 rendered in accent blue as though it were live. The step a closed
 * movement stopped at is marked `stopped`, which is worded and styled as a full stop, never as
 * "you are here".
 */
function MovementTrack({ movement, now, open }: { movement: Movement; now: Instant; open: boolean }) {
  const reachedIndex = MOVEMENT_STAGES.indexOf(movement.stage);
  return (
    <ol className={styles.track} data-testid="ward-console-track">
      {MOVEMENT_STAGES.map((stage, index) => {
        const Icon = stageIcons[stage];
        const state: StepState =
          index < reachedIndex ? "done" : index > reachedIndex ? "ahead" : open ? "current" : "stopped";
        const at = state === "ahead" ? undefined : stageReachedAt(movement, stage);
        return (
          <li className={styles.trackStep} key={stage} data-state={state}>
            <span className={styles.trackMark} aria-hidden="true">
              <Icon aria-hidden="true" />
            </span>
            <span className={styles.trackBody}>
              <strong className={styles.trackLabel}>
                {index + 1}. {stageCopy[stage].label}
              </strong>
              <span className={styles.trackWhen}>{trackStepSentence(movement, state, at, now)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * ONE PLAIN SENTENCE PER STEP, and every absence is one of them.
 *
 * Leads with what is still true and only then names what is missing — "reached, but no time was
 * recorded" describes the patient; "no time recorded" alone describes the database.
 */
export function trackStepSentence(movement: Movement, state: StepState, at: Instant | undefined, now: Instant): string {
  if (state === "ahead") return "Not reached.";
  if (state === "stopped") {
    const stopped = movement.closure
      ? `This is where it stopped: ${movement.closure.reason}.`
      : "This is where it stopped. Nothing on the record says why.";
    return at === undefined
      ? `${stopped} No time was recorded for reaching this step.`
      : `${stopped} Reached ${formatInstantWithDay(at, now)}.`;
  }
  if (state === "current") {
    return at === undefined
      ? "This is where the movement is now. No time was recorded for reaching this step."
      : `This is where the movement is now, since ${formatInstantWithDay(at, now)}.`;
  }
  return at === undefined ? "Passed. No time was recorded for this step." : `Passed ${formatInstantWithDay(at, now)}.`;
}

export type Attention = { key: string; who: string; chip: string; level: WardChipLevel; say: string };

/**
 * WHAT IS WRONG WITH THIS ONE MOVEMENT, as sentences — the panel that did not exist before
 * 2026-09-04 and the largest single gain on this page.
 *
 * ⚠️ EVERY ITEM IS A LOCATOR PLUS ONE PLAIN SENTENCE SAYING WHAT IS WRONG AND WHAT IT MEANS. Not a
 * count, not a badge, not a coloured bar. Six of the eleven review findings were things this page
 * held in a field and never said out loud — an expired bed pull, an escort requirement, a stalled
 * referral, an unlawful destination, an unanswered transport question, a breached deadline.
 *
 * ⚠️ NOTHING HERE IS RAISED ON A CLOSED MOVEMENT. An expired bed pull on a movement that closed
 * two hours ago is not something anybody can act on, and listing it as attention would send a
 * coordinator to chase a patient who is not there. The closed case gets one item saying so.
 */
/**
 * ⚠️ **THE ONE ITEM IN THIS RAIL ABOUT A REAL VEHICLE.** Everything else here is a fact about a
 * record; this is an ambulance and a crew, dispatched against a bed that has gone back to the ward.
 * Ward Lead, 2026-09-06: *"That is not a stale record — it is a real vehicle and a real crew."*
 *
 * It is `urgent` for that reason and not because orphaned records are important in general.
 */
export function orphanedTransportAttention(movement: Movement): Attention | undefined {
  const orphan = orphanedTransport(movement);
  if (orphan === undefined) return undefined;
  return {
    key: "orphaned-transport",
    who: `Transport booked with ${orphan.provider}`,
    chip: orphan.kind === "pull_released" ? "No bed held" : "Record behind",
    // `stalled`, not `urgent`: a stage correction never released a bed, so this one needs a
    // person to check rather than to act. `WardChipLevel` has no "attention" member — the ladder is
    // urgent / stalled / routine / accepted / enroute / cancelled.
    level: orphan.kind === "pull_released" ? "urgent" : "stalled",
    say:
      orphan.kind === "pull_released"
        ? `The bed this job was booked against has been given back to the ward, and the job was not ` +
          `cancelled with it. ${orphan.provider} is still recorded as collecting this patient, and ` +
          `until the job is cancelled a replacement cannot be booked — the reducer refuses a second ` +
          `job. Cancel it, in What you can do here below.`
        : `The recorded stage has been moved back behind the booking, so this page can no longer say ` +
          `a bed is being held. Correcting a stage does not release a bed, so the ward may still be ` +
          `holding one — check with them before cancelling ${orphan.provider}.`,
  };
}

export function attentionItems({
  movement,
  units,
  now,
  destination,
  open,
  blockerIsActive,
}: {
  movement: Movement;
  units: Unit[];
  now: Instant;
  destination: Unit | undefined;
  open: boolean;
  blockerIsActive: boolean;
}): Attention[] {
  if (!open) {
    /*
     * ⚠️ THE REASON IS DELIBERATELY NOT REPEATED HERE. The closure panel directly above states it
     * as the page's dominant line, and the step track states it again at the step it stopped on.
     * A third copy in the rail was on screen for ten minutes on 2026-09-04 and read as three
     * different systems each noticing the same thing — this says what the rail is FOR on a closed
     * movement instead: nothing to chase, and which checks were therefore not run.
     */
    return [
      {
        key: "closed",
        who: "Nothing to chase",
        chip: movement.closure?.outcome === "arrived" ? "Arrived" : "Closed",
        level: movement.closure?.outcome === "arrived" ? "accepted" : "cancelled",
        say: "No deadline, bed pull, escort, referral or transport check is raised on this movement, because none of them can be acted on now. What happened, and why it stopped, is stated above.",
      },
    ];
  }

  const items: Attention[] = [];

  /*
   * ⚠️ FIRST IN THE RAIL, DELIBERATELY. This is the only item here about a real vehicle rather than
   * about a record, and Ward Lead ruled it the most serious thing found on 2026-09-06. Pushed
   * before every other check so it cannot be read after four record-keeping notes.
   */
  const orphaned = orphanedTransportAttention(movement);
  if (orphaned) items.push(orphaned);

  const deadline = movement.legalForm?.dueAt;
  if (movement.legalForm && deadline !== undefined) {
    const state = clockState(deadline, now);
    if (state === "breached") {
      items.push({
        key: "deadline",
        who: legalFormNameLabelFirst(movement.legalForm),
        chip: "Overdue",
        level: "urgent",
        say: `The deadline recorded on this form passed at ${formatInstantWithDay(deadline, now)} — ${formatRemaining(minutesUntil(deadline, now))}. Nothing on this record says it has been dealt with.`,
      });
    } else if (state === "critical" || state === "due") {
      items.push({
        key: "deadline",
        who: legalFormNameLabelFirst(movement.legalForm),
        chip: "Due soon",
        level: "stalled",
        say: `This form's recorded deadline is ${formatInstantWithDay(deadline, now)} — ${formatRemaining(minutesUntil(deadline, now))}.`,
      });
    }
  }

  if (movement.pullExpiresAt !== undefined && movement.pullExpiresAt <= now) {
    items.push({
      key: "pull",
      who: destination ? `Bed pulled at ${destination.name}` : "Bed pulled for this patient",
      chip: "Pull expired",
      level: "urgent",
      say: `The pull on that bed ran out at ${formatInstantWithDay(movement.pullExpiresAt, now)} — ${formatRemaining(minutesUntil(movement.pullExpiresAt, now))}. Unless the ward has kept it anyway, nothing is being kept for this patient.`,
    });
  }

  const unlawful = destinationNoLongerLawful(movement, units);
  if (unlawful) {
    items.push({
      key: "unlawful",
      who: unlawful.name,
      chip: "Not authorised",
      level: "urgent",
      say: `This patient's legal status now requires an authorised destination, and the ward that accepted them is not one. The placement needs revisiting before they travel.`,
    });
  }

  const restriction = destination ? restrictionNotice(movement, destination) : undefined;
  if (restriction) {
    items.push({
      key: "restriction",
      who: destination ? destination.name : movement.id,
      chip: restriction.level === "voluntary_on_locked" ? "Legal risk" : "More restrictive",
      level: restriction.level === "voluntary_on_locked" ? "urgent" : "stalled",
      say: `${restriction.text}.`,
    });
  }

  if (movement.transport?.escortRequired === true) {
    items.push({
      key: "escort",
      who: `Transport — ${movement.transport.provider}`,
      chip: "Escort required",
      level: "stalled",
      say: "This patient must not travel unescorted. The record says an escort is required; it does not say one has been arranged, and there is no field on this movement that could say so.",
    });
  }

  if (movement.declines.length > 0 && movement.acceptedUnitId === undefined) {
    items.push({
      key: "stalled",
      who: `${movement.declines.length} ward${movement.declines.length === 1 ? "" : "s"} declined`,
      chip: "Stalled",
      level: "stalled",
      say: `${movement.declines.length} ward${movement.declines.length === 1 ? " has" : "s have"} declined this movement and none has accepted. Nothing moves until one does, or until somebody escalates.`,
    });
  }

  if (movement.escalation) {
    items.push({
      key: "escalation",
      who: movement.escalation.contact,
      chip: "Escalated",
      level: "stalled",
      say: `This movement was escalated to ${movement.escalation.contact} at ${formatInstantWithDay(movement.escalation.at, now)}. The record does not hold an answer, so somebody has to ask.`,
    });
  }

  /*
   * ═══ THE TWO TRANSPORT PROMPTS, AND THEY COVER DISJOINT STAGES ON PURPOSE ═══
   *
   * Before a bed is pulled, the open question is whether this patient needs transport at all.
   * Once a bed IS pulled, the open question is why nobody has booked it — a different sentence to
   * a different person, and `TR-D4`'s whole subject.
   *
   * ⚠️ **THEY MUST NOT BOTH FIRE.** Two attention items about transport, on one movement, at one
   * moment, is the failure this rail was corrected for in September: a coordinator reads them as
   * two systems each noticing something and trusts neither. The stage boundary below is what makes
   * them exclusive, and it is `pulled` for both so no stage falls between them.
   */
  const pulledIndex = MOVEMENT_STAGES.indexOf("pulled");
  const stageIndex = MOVEMENT_STAGES.indexOf(movement.stage);

  // Only once a destination has accepted: before that, "nobody has said whether transport is
  // needed" is the ordinary state of a movement nobody has placed yet, and raising it as attention
  // on every fresh referral is how an attention panel stops being read.
  if (
    transportNeedState(movement) === "not_recorded" &&
    movement.transport === undefined &&
    stageIndex >= MOVEMENT_STAGES.indexOf("accepted_awaiting_bed") &&
    stageIndex < pulledIndex
  ) {
    items.push({
      key: "transport-need",
      who: "Transport",
      chip: "Unanswered",
      level: "routine",
      say: "Nobody has recorded whether this patient needs transport. That is not the same as deciding they do not — a bed is held and no journey is planned.",
    });
  }

  /*
   * 🔴 **`TR-D4`'s PROMPT, AND IT IS THE MITIGATION FOR A COST THE OWNER ACCEPTED.** `TR-D1` puts
   * booking on the SENDING team, and its recorded cost is that they have the weakest reason to
   * chase it — the patient is leaving them either way. `TR-D4` is the answer: *"the receiving
   * ward, which knows when it is ready, triggers them"*, so they are not relying on their own
   * memory. **`TR-D1` shipped. Its mitigation did not**, and the ledger's own status audit named
   * this as the one row to act on.
   *
   * ⚠️ **NO NEW EVENT AND NO NEW FIELD, WHICH IS THE WHOLE POINT OF THE PROPOSAL THIS CAME FROM.**
   * The readiness signal already exists and it is `PULL_PATIENT` — refused when the ward has no
   * allocatable bed, refused when every free bed is still being made ready, refused when
   * specialling capacity would be exhausted. A `SIGNAL_READY` event would be a second act meaning
   * the same thing at strictly lower safety. **The pull is already recorded, with a time. What was
   * missing was somebody being told.**
   *
   * ⚠️ **NOT RAISED WHEN SOMEBODY HAS ANSWERED THAT NO TRANSPORT IS NEEDED.** That is an answer,
   * not a gap, and prompting a booking against it would be the software overriding a person.
   *
   * ⚠️ **AND IT SENDS THE READER TO THE WARD BEFORE THE PROVIDER — OWNER RULING 17, 2026-09-06,
   * read at source before this was written.** *"It stays a convenience, and a 'confirm with the
   * ward' step goes on any placement action."* His reasoning is the hazard it settles: **a good
   * board becomes the source of truth without anybody deciding it has.** He has decided it has not.
   *
   * **This prompt is exactly the shape that ruling is about.** It reads a bed off the board and
   * tells somebody to commit a vehicle to it — and the board can be behind: `RELEASE_PULL` hands
   * the bed back and this page has to be looked at to know. A booking made on a stale figure is a
   * real crew dispatched to a bed that is gone, which is the defect the orphaned-job surface below
   * exists to catch AFTER the fact. **Confirming first is what stops it happening.**
   *
   * ⚠️ **IT BOUNDS THE CLAIM, NOT THE CARE.** The ruling does not license treating this figure as
   * unimportant, and the sentence must not read as "this number is probably wrong" — it reads as
   * "ring them, then book".
   */
  if (movement.transport === undefined && stageIndex >= pulledIndex && transportNeedState(movement) !== "not_needed") {
    const answered = transportNeedState(movement) === "needed";
    items.push({
      key: "book-transport",
      who: "Transport",
      chip: "Not booked",
      level: "urgent",
      say: answered
        ? `${destination ? `${destination.name} has` : "The ward has"} a bed held for this patient and transport is recorded as needed, but no job has been raised. The sending team books it — nobody else can — and the bed is being held while nothing moves. ${CONFIRM_WITH_THE_WARD}`
        : `${destination ? `${destination.name} has` : "The ward has"} a bed held for this patient and no transport job exists. Nobody has recorded whether transport is needed either, so that answer is owed first — and if it is, the sending team books it. The bed is being held while nothing moves. ${CONFIRM_WITH_THE_WARD}`,
    });
  }

  if (blockerIsActive) {
    items.push({
      key: "blocker",
      who: "Recorded by hand",
      chip: "Blocked",
      level: "stalled",
      say: `Somebody wrote: “${movement.blocker}”. That is free prose about what is holding this up, not a ward's answer.`,
    });
  }

  return items;
}

/**
 * ⚠️ **THIS IS A MOVEMENT WORKSPACE, AND ITS PROP NOW SAYS SO.** It was `patientId: string`, and
 * the body looks the value up in `movements` — so the name invited a real patient id and nothing
 * stopped one being passed. It worked only because every call site happened to pass a movement.
 * The prop is now `movementId: MovementId`, so the mistake the old name invited fails to compile
 * rather than rendering a dead-end "no movement matches" page.
 *
 * The ROUTE was `/patients/[patientId]` and just as misleading to a human reader
 * as the prop had been to the compiler. It has since moved to
 * `/mockups/ward-flow/movements/[movementId]`, nested under the existing `movements` mode page —
 * the site map, the reachability assertion and this file's own doc comment all moved with it.
 *
 * ⚠️ **THE PAGE HAS A TENSE NOW, AND THAT WAS THE DEFECT UNDER MOST OF THE OTHERS** (Ward Lead
 * ruling 2, 2026-09-04). A closed movement is a DIFFERENT ARRANGEMENT of this page, not the same
 * page with a banner on top: what happened comes first and dominant, the live tools demote and go
 * quiet, "Current stage" becomes "Stopped at", and the step track shows where it stopped rather
 * than a highlighted step nobody is standing on.
 *
 * ⚠️ **THE READER IS A COORDINATOR WHO ARRIVED FROM A LIST.** Every route in is a list — patient
 * search, the tracker's review link, four mode screens, the network view — so this page never has
 * to introduce the patient. It opens on the answer: what is wrong, then what it means, then the
 * three things a person can actually do.
 */
/**
 * ⚠️ **THE ROUTE USED TO QUOTE BACK AN ID THE USER NEVER TYPED.** `MovementId` is the template
 * literal type `` `WF-${string}` ``, so the bare string `"WF-"` satisfies it — and the route was
 * using exactly that as a sentinel for "this is not a movement id at all", handing it to a page
 * whose not-found sentence then quoted it. `/movements/PT-004` rendered *No synthetic movement
 * matches “WF-”*. Well-typed, so `tsc` could not see it; asserted by no test; and a page telling a
 * clinician something they did not type is the kind of thing that ends up in a screenshot.
 *
 * The sentinel is gone. The route now renders this component directly for a wrong-shaped id, so
 * there is no cast on that path and nothing to quote back wrongly, and the two cases say different
 * things because they ARE different: one is "that is not the sort of thing this screen shows", the
 * other is "it is, and there is no such one".
 *
 * 🔴 AND THE FIRST VERSION OF THIS FIX INTRODUCED A WORSE FALSE STATEMENT THAN THE ONE IT REPLACED.
 * It ended "a person is not a movement, and their record is not reachable from here." A person's
 * record IS reachable: `/mockups/ward-flow/people/[patientId]` renders it, and the patient search
 * links straight to it. So the page sent a coordinator AWAY from the screen holding what they
 * wanted, fluently and with authority. **The old bug quoted nonsense and the reader looked
 * elsewhere; this one was believable.** Caught by an adversarial review, not by me, and not by any
 * test. The lesson is the one worth keeping: every one of these six fixes replaced a sentence with
 * another sentence, and a replacement is a new claim that needs checking exactly as hard as the
 * one it removes.
 */
export function WardMovementNotFound({
  requestedId,
  reason,
}: {
  requestedId: string;
  reason: "no-such-movement" | "not-a-movement-id" | "not-a-person-id";
}) {
  return (
    <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
      <header className={styles.workspaceHeader}>
        <ContextualBackLink fallbackHref="/mockups/ward-flow" aria-label="Back to Ward Flow">
          <ArrowLeft aria-hidden="true" />
        </ContextualBackLink>
        <div>
          <span>Ward Flow</span>
          <span className={styles.headerCrumb}>
            {reason === "not-a-person-id" ? "Person not found" : "Movement not found"}
          </span>
        </div>
      </header>
      <main id="main-content" className={styles.workspaceMain}>
        <div className={styles.masthead}>
          <span className={styles.eyebrow}>
            {reason === "not-a-person-id" ? "Person record" : "Movement workspace"}
          </span>
          <h1 className={styles.mastheadTitle}>
            {reason === "not-a-person-id" ? "Person not found" : "Movement not found"}
          </h1>
        </div>
        <p className={styles.governanceNote}>
          {reason === "not-a-person-id" ? (
            <>
              &ldquo;{requestedId}&rdquo; is not a person&rsquo;s record number.{" "}
              {requestedId.startsWith("WF-") ? (
                <>
                  It is a movement id.{" "}
                  <Link href={`/mockups/ward-flow/movements/${requestedId}`}>Open that movement instead</Link>.
                </>
              ) : (
                <>Record numbers (UMRN) identify a person. This screen shows one person&rsquo;s own record.</>
              )}
            </>
          ) : reason === "not-a-movement-id" && requestedId.startsWith("PT-") ? (
            <>
              &ldquo;{requestedId}&rdquo; is a person&rsquo;s record identifier, not a movement id. This screen shows one
              movement at a time.{" "}
              <Link href={`/mockups/ward-flow/people/${requestedId}`}>Open that person&rsquo;s record instead</Link>.
            </>
          ) : reason === "not-a-movement-id" ? (
            <>
              &ldquo;{requestedId}&rdquo; is not a movement id. Movement ids begin with WF-. This screen shows one
              movement at a time.
            </>
          ) : (
            <>
              No synthetic movement matches &ldquo;{requestedId}&rdquo;. It may have arrived and closed, or the id is
              incorrect.
            </>
          )}
        </p>
      </main>
    </div>
  );
}

/*
 * The reason each correction control states while it is inert. Named constants because each is
 * rendered TWICE — once as the `title` a pointer user gets, once as the visually hidden text an
 * `aria-describedby` reader gets — and two copies of a sentence drift. Same shape as
 * `DECLINE_REASON_UNCHOSEN` in `referral-match.tsx`.
 */
const WITHDRAW_REASON_UNCHOSEN = "Choose why the acceptance is being withdrawn first. The ward reads the reason.";
const STEP_BACK_UNCHOSEN = "Choose the stage and the reason first. Both are recorded on this movement's audit trail.";
const CANCEL_TRANSPORT_UNCHOSEN = "Choose why the transport job is being cancelled first. The provider is told.";
const URGENT_FLAG_UNCHOSEN = "Choose why this patient is being flagged urgent first.";

/**
 * ⚠️ **OWNER RULING 17, 2026-09-06 — THE ONE THAT BOUNDS EVERY OTHER ONE.** *"It stays a
 * convenience, and a 'confirm with the ward' step goes on any placement action."* The hazard he
 * settled is drift: **a good board becomes the source of truth without anybody deciding it has.**
 *
 * One constant rather than a sentence retyped per prompt — his ruling, and two wordings of it would
 * be two rulings. Named so any future placement prompt can carry the same words without rediscovering
 * that this is a ruling rather than a nicety.
 */
const CONFIRM_WITH_THE_WARD =
  "Ring the ward and confirm the bed before booking — this board is a convenience, not the record.";

export function WardPatientWorkspace({ movementId }: { movementId: MovementId }) {
  const { movements } = useWardFlow();
  const patient = movements.find((candidate) => candidate.id === movementId);

  if (!patient) {
    return <WardMovementNotFound requestedId={movementId} reason="no-such-movement" />;
  }

  return <MovementWorkspaceCockpit movementId={movementId} />;
}
