import { daysInBed, type Admission, type DischargeBarrier } from "@/components/ward-management/ward-admissions";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";

/**
 * Stranded-patient prompts (smart feature 12, owner request 4 October 2026).
 *
 * A GENTLE PROMPT, NOT A JUDGEMENT. Two recorded facts are read and nothing is inferred:
 *
 *   - `long-stay-no-plan` — somebody has been in the bed for at least `LONG_STAY_PROMPT_DAYS`
 *     and the ward has recorded no expected discharge date.
 *   - `ready-but-waiting` — the ward has recorded a hold whose cause sits outside the ward:
 *     accommodation, a placement, a receiving service, family or carer arrangements, or a funding
 *     or plan decision (the NDIS case). These are where hidden bed-days sit.
 *
 * Same-day logistics holds (`Awaiting clean`, `Awaiting pharmacy`, `Awaiting transport`) are
 * deliberately NOT prompts: they clear within a shift and flagging them would bury the people
 * who are genuinely stranded.
 *
 * `LONG_STAY_PROMPT_DAYS` reuses the seven-day long-stay line the ward board, handover and
 * `DISCHARGE_BARRIERS` already use. It is a prompt to record a plan, never a target length of stay
 * and never a figure from the Mental Health Act.
 *
 * Only `occupied` admissions are read: a pulled bed has no stay yet, and a departed one is gone.
 */
export const LONG_STAY_PROMPT_DAYS = CLINICAL_VALUES.longStayPrompt.value;

export const STRANDED_WAITING_BLOCKERS = [
  "Awaiting accommodation",
  "Awaiting placement confirmation",
  "Awaiting service coordination",
  "Awaiting receiving-service acceptance",
  "Awaiting family or carer arrangement",
  "Funding or plan decision pending",
] as const satisfies readonly BedReleaseBlocker[];

type StrandedReason = "long-stay-no-plan" | "ready-but-waiting";

export type StrandedFlag = {
  admissionId: string;
  reasons: readonly StrandedReason[];
  /** Whole days in the bed; never null here, because only arrived admissions are read. */
  days: number;
  /** The recorded hold, when it is one of `STRANDED_WAITING_BLOCKERS`. */
  waitingOn: BedReleaseBlocker | null;
  /** The recorded long-stay barrier, shown as context only. */
  barrier: DischargeBarrier | null;
};

function isStrandedWaitingBlocker(value: BedReleaseBlocker | null): boolean {
  return value !== null && (STRANDED_WAITING_BLOCKERS as readonly string[]).includes(value);
}

/**
 * Who on these admissions is worth a gentle prompt, longest stay first (ties by id, so two renders
 * of one state never reshuffle). The caller scopes `admissions` to one ward.
 */
export function strandedFlags(
  admissions: readonly Admission[],
  now: Instant,
  bedReleases?: readonly BedRelease[],
): StrandedFlag[] {
  const flags: StrandedFlag[] = [];
  for (const admission of admissions) {
    if (admission.state !== "occupied") continue;
    const days = daysInBed(admission, now);
    if (days === null) continue;

    const reasons: StrandedReason[] = [];
    const expected = admission.expectedDischargeAt;
    const hasPlan = expected !== null && Number.isFinite(expected);
    if (days >= LONG_STAY_PROMPT_DAYS && !hasPlan) reasons.push("long-stay-no-plan");
    const releaseBlocker = bedReleases?.find(
      (r) => r.admissionId === admission.id && r.state !== "discharged",
    )?.blocker;
    const effectiveBlocker = releaseBlocker ?? admission.blockReason ?? null;
    const waiting = isStrandedWaitingBlocker(effectiveBlocker);
    if (waiting) reasons.push("ready-but-waiting");
    if (reasons.length === 0) continue;

    flags.push({
      admissionId: admission.id,
      reasons,
      days,
      waitingOn: waiting ? effectiveBlocker : null,
      barrier: admission.dischargeBarrier ?? null,
    });
  }
  return flags.sort((a, b) =>
    a.days !== b.days ? b.days - a.days : a.admissionId < b.admissionId ? -1 : a.admissionId > b.admissionId ? 1 : 0,
  );
}

const MINUTES_PER_HOUR = 60;

export type LongStaySummary = {
  flag: StrandedFlag;
  /** The ward's recorded hold on the admission, shown as recorded. */
  blockReason: BedReleaseBlocker | null;
  /** Hours the escalation point sits after the expected discharge date. */
  escalateAfterHours: number;
  /** Expected discharge date plus `escalateAfterHours`; undefined while no date is recorded. */
  escalationAt: Instant | undefined;
  /** Whole hours past the expected discharge date; undefined when no date or not yet passed. */
  hoursPastExpected: number | undefined;
  escalationReached: boolean;
};

/**
 * Long stay and delayed discharge summary (Top 25 item 20, flag `top25-long-stay-dossier`). One
 * entry per stranded flag with the days in bed, the recorded barrier and hold, and the escalation
 * point: `delayedDischargeEscalation` hours after the ward's own expected discharge date. Only the
 * date a person recorded is read; nothing here is a legal time limit. Replaces the showcase's
 * `deriveMaroonedPatientDossier`, whose inputs are not on an admission.
 */
export function longStaySummaries(
  admissions: readonly Admission[],
  now: Instant,
  bedReleases?: readonly BedRelease[],
): LongStaySummary[] {
  const byId = new Map(admissions.map((admission) => [admission.id, admission]));
  const escalateAfterHours = CLINICAL_VALUES.delayedDischargeEscalation.value;
  const flags = strandedFlags(admissions, now, bedReleases);
  // A stay past its own expected discharge date belongs here too, even with no waiting hold, or
  // its escalation point could never show.
  const flagged = new Set(flags.map((flag) => flag.admissionId));
  for (const admission of admissions) {
    const expected = admission.expectedDischargeAt;
    if (admission.state !== "occupied" || flagged.has(admission.id)) continue;
    if (expected === null || !Number.isFinite(expected) || now <= expected) continue;
    const days = daysInBed(admission, now);
    if (days === null) continue;
    flags.push({
      admissionId: admission.id,
      reasons: [],
      days,
      waitingOn: null,
      barrier: admission.dischargeBarrier ?? null,
    });
  }
  flags.sort((a, b) =>
    a.days !== b.days ? b.days - a.days : a.admissionId < b.admissionId ? -1 : a.admissionId > b.admissionId ? 1 : 0,
  );
  return flags.map((flag) => {
    const admission = byId.get(flag.admissionId);
    const expected = admission?.expectedDischargeAt ?? null;
    const hasDate = expected !== null && Number.isFinite(expected);
    const escalationAt = hasDate ? expected + escalateAfterHours * MINUTES_PER_HOUR : undefined;
    const hoursPastExpected = hasDate && now > expected ? Math.floor((now - expected) / MINUTES_PER_HOUR) : undefined;
    return {
      flag,
      // The same effective hold `strandedFlags` reads: a live release blocker first, then the stay's.
      blockReason:
        flag.waitingOn ??
        bedReleases?.find((release) => release.admissionId === flag.admissionId && release.state !== "discharged")
          ?.blocker ??
        admission?.blockReason ??
        null,
      escalateAfterHours,
      escalationAt,
      hoursPastExpected,
      escalationReached: escalationAt !== undefined && now > escalationAt,
    };
  });
}

/** The prompt in plain words, for one flag. */
export function strandedPromptText(flag: StrandedFlag): string {
  const parts: string[] = [];
  if (flag.reasons.includes("long-stay-no-plan")) {
    parts.push("No expected discharge date recorded yet");
  }
  if (flag.waitingOn !== null) {
    parts.push(`Ready but waiting: ${flag.waitingOn.replace(/^Awaiting /, "").toLowerCase()}`);
  }
  return parts.join(" · ");
}
