import {
  daysInBed,
  isPastExpectedDischarge,
  stayDayNumber,
  type Admission,
  type PlannedAdmission,
} from "@/components/ward-management/ward-admissions";
import {
  ED_STAGE_LABELS,
  edHomeSummaries,
  elapsedOpenMinutes,
  isUnderAForm,
} from "@/components/ward-management/ed/ed-home-derivations";
import { edBayAssignments, movementMedicalClearance } from "@/components/ward-management/ed/ed-screen-model";
import {
  currentLegalDueAt,
  currentLegalStanding,
  FORM_RECORDED_ENDED,
  formProgression,
  formRecordedEnded,
  NEXT_FORM_TO_RECORD,
} from "@/components/ward-management/ward-legal-form-progression";
import {
  LEGAL_STATUSES_DIFFER,
  legalStatusesDiffer,
  stayLegalStatus,
  stayLegalStatusesDiffer,
} from "@/components/ward-management/ward-stay-legal";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { HELD_UP_BY_TOMORROW_LABEL, isHeldUpDueByTomorrow } from "@/components/ward-management/ward-held-up";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { riskFlagLabel } from "@/components/ward-management/referrals/referral-risk-flags";
import {
  DEFAULT_DUE_SOON_THRESHOLDS,
  dayOf,
  formatInstantWithDay,
  splitDuration,
  type DueSoonThresholds,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import {
  isConstantObservation,
  observationSummary,
  type Observation,
} from "@/components/ward-management/ward-observation";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  TV_LEAVE_DUE_BACK_WINDOW_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import type { Patient } from "@/components/ward-management/ward-patients";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";

/**
 * THE CLINICAL TV BOARDS (Josh, Notion "Bed TV" issue 1 and 4 Nov 2026): the ward and ED screens
 * "made for actual clinical use", beside the bed flow views. One row per person, every fact read
 * from the record the ward or ED screen already shows. Nothing is scored or inferred: obs is the
 * level the ward staffs the bed at, risk flags are the referrer's own ticks, legal times are as
 * typed (D-93). Synthetic data only.
 */

/** A tone a row or a fact carries on the wall: act now, watch, or nothing. */
type ClinicalTone = "danger" | "warning" | undefined;

export type ClinicalFact = { text: string; tone?: ClinicalTone };

export type WardClinicalRow = {
  key: string;
  /** "01", or "Pulled" for a bed taken by someone not yet arrived. */
  bed: string;
  bedNumber: number;
  name: string;
  /** Day of the stay, arrival day = Day 1. `null` before arrival. */
  dayNumber: number | null;
  where: "ward" | "leave" | "awol" | "incoming" | "ed";
  obs: ClinicalFact;
  constantObs: boolean;
  risks: string[];
  legal: ClinicalFact | null;
  /** Leave, AWOL, away at ED or coming in: where the person is when not on the ward. */
  whereabouts: ClinicalFact | null;
  /** The ward's expected date, held up reason or past date. */
  plan: ClinicalFact | null;
  arrivedToday: boolean;
  goingToday: boolean;
  /**
   * D-197 item 6: for "Held up · by tomorrow, or overdue". Held up by tomorrow (D-191 item 5, the
   * rule `heldUpStayKeys` counts with) or past the expected date, and not going home today.
   */
  stuck: boolean;
  /** Attention items for the handover board, worded for the wall. */
  attention: { group: HandoverGroup; text: string; tone: ClinicalTone }[];
};

export const HANDOVER_GROUPS = [
  { id: "missing", title: "Absent without leave" },
  { id: "legal", title: "Legal forms ending" },
  { id: "leave", title: "Leave due back" },
  { id: "obs", title: "Constant observation" },
  { id: "arrivals", title: "Arriving or new today" },
  { id: "going", title: "Going home today" },
  { id: "stuck", title: `${HELD_UP_BY_TOMORROW_LABEL}, or overdue` },
] as const;
type HandoverGroup = (typeof HANDOVER_GROUPS)[number]["id"];

type RecordInputs = {
  movements: readonly Movement[];
  referrals: readonly Referral[];
  patients: readonly Patient[];
  plannedAdmissions?: readonly PlannedAdmission[];
  /** The board's day 0, so a typed legal time on another day prints its date (D1, D-93). */
  dayZero?: Date;
  /** The signed legal warnings as set in Settings (`dueSoon`, D-24); the defaults when left out. */
  thresholds?: DueSoonThresholds;
};

/** The referrer's risk ticks for a journey, as words. The referral's own copy wins over the officer copy. */
function riskWords(movement: Movement | undefined, referralId: string | null | undefined, records: RecordInputs) {
  const referral =
    records.referrals.find((candidate) => candidate.id === (referralId ?? movement?.referralId)) ?? undefined;
  const flags = referral?.intake?.riskFlags ?? movement?.collectionRiskFlags ?? [];
  return flags.map(riskFlagLabel);
}

function obsFact(observation: Observation | undefined): ClinicalFact {
  if (!observation) return { text: "Not recorded" };
  const constant = isConstantObservation(observation);
  return { text: observationSummary(observation), tone: constant ? "warning" : undefined };
}

/**
 * A legal form's line for the wall: the status, then the form and its end time as typed. "Ending soon"
 * is the signed due soon warning (`dueSoon`), never a window of its own (D-194).
 *
 * D-210 (Josh, 14 Nov 2026), ruling 3 (audit M4): the same bands as Forms, Delays and ED, from
 * Settings (`currentLegalStanding`). Red, Act now, from the urgent warning (default 1 h) on, and
 * once the typed time has passed; amber, Ending soon, within the soon warning (default 3 h). At the
 * typed minute itself the line still reads "Ends", as every other screen does.
 *
 * Ruling 5 (audit M13a): when the stay and the patient record hold different statuses, the line
 * carries the patient page's own "statuses differ" words (`differs`).
 */
function legalFact(
  status: string | undefined,
  movement: Movement | undefined,
  now: Instant,
  dayZero: Date | undefined,
  thresholds: DueSoonThresholds = DEFAULT_DUE_SOON_THRESHOLDS,
  differs = false,
): ClinicalFact | null {
  const fact = legalFactOnly(status, movement, now, dayZero, thresholds);
  if (!fact || !differs) return fact;
  return { ...fact, text: `${fact.text}. ${LEGAL_STATUSES_DIFFER}` };
}

function legalFactOnly(
  status: string | undefined,
  movement: Movement | undefined,
  now: Instant,
  dayZero: Date | undefined,
  thresholds: DueSoonThresholds,
): ClinicalFact | null {
  const form = movement?.legalForm;
  if (!form) return status ? { text: status } : null;
  const progression = formProgression(movement);
  if (progression)
    return {
      // D-170 item 1 and A1: the form as recorded and the next form to record, never an inferred end.
      text: `${NEXT_FORM_TO_RECORD}, on Form ${progression.formCode} ${progression.when}`,
      tone: "danger",
    };
  // D-93: the form by its full name, as every other output names it (M17, 10 Nov 2026).
  const head = `${legalFormName(form)}${status ? `, ${status.toLowerCase()}` : ""}`;
  if (formRecordedEnded(movement)) return { text: `${head}. ${FORM_RECORDED_ENDED}` };
  const dueAt = currentLegalDueAt(movement);
  if (dueAt === undefined) return { text: head };
  const standing = currentLegalStanding(movement, now, thresholds);
  return {
    text: `${head}. ${typedTimeLine(dueAt, now, dayZero)}`,
    tone: standing === "passed" || standing === "urgent" ? "danger" : standing === "soon" ? "warning" : undefined,
  };
}

export type WardClinicalInputs = RecordInputs & {
  unit: Unit;
  admissions: readonly Admission[];
  leaveBeds: readonly LeaveBed[];
  bedReleases: readonly BedRelease[];
  now: Instant;
  nameOf: (subject: Admission | Movement) => string;
};

/** Every person this ward holds a bed for, by bed number, with the facts a ward office wall needs. */
export function wardClinicalRows(input: WardClinicalInputs): WardClinicalRow[] {
  const { unit, admissions, leaveBeds, bedReleases, now, nameOf } = input;
  const stays = admissions.filter(
    (admission) => admission.unitId === unit.id && (admission.state === "occupied" || admission.state === "pulled"),
  );
  const seats = wardStaySeats(unit, admissions as Admission[]);
  const today = dayOf(now);

  return stays
    .map((admission): WardClinicalRow => {
      const movement = input.movements.find(
        (candidate) =>
          (admission.movementId !== null && candidate.id === admission.movementId) ||
          candidate.admissionId === admission.id,
      );
      const leave = leaveBeds.find((record) => record.admissionId === admission.id && record.unitId === unit.id);
      const bedNumber = admission.bedNumber ?? seats.get(admission.id) ?? 999;
      const pulled = admission.state === "pulled";
      const days = pulled ? null : daysInBed(admission, now);
      // D-210 (Josh, 14 Nov 2026), ruling 5 (audit M13a): the patient page's rule. The stay's own
      // status wins, then the converted booking, then the patient record (`stayLegalStatus`), and
      // the wall carries the same "statuses differ" mark the patient page shows.
      const status = stayLegalStatus(admission, input);
      const legal = legalFact(
        status,
        movement,
        now,
        input.dayZero,
        input.thresholds,
        stayLegalStatusesDiffer(admission, input),
      );
      const release = bedReleases.find(
        (record) => record.admissionId === admission.id && record.state !== "discharged",
      );
      const blockReason = release?.blocker ?? admission.blockReason ?? null;
      // D-191 item 5: held up means due by tomorrow; a later blocker stays on the row's plan line only.
      const heldUpByTomorrow = release !== undefined && isHeldUpDueByTomorrow(release, now);
      const pastDate = !pulled && isPastExpectedDischarge(admission, now);
      const expected = admission.expectedDischargeAt;
      const goingToday =
        !pulled &&
        ((expected !== null && expected !== undefined && dayOf(expected) === today) ||
          (release !== undefined && dayOf(release.expectedAt ?? now) === today));

      let where: WardClinicalRow["where"] = "ward";
      let whereabouts: ClinicalFact | null = null;
      if (pulled) {
        where = "incoming";
        const eta = movement?.transport?.estimatedAt;
        whereabouts = {
          text:
            movement?.transport?.collectedAt !== undefined
              ? `On the way${eta === undefined ? "" : `, due ${formatInstantWithDay(eta, now)}`}`
              : "Bed pulled, not yet arrived",
        };
      } else if (leave?.absentWithoutLeave) {
        where = "awol";
        whereabouts = {
          text: `Absent without leave since ${formatInstantWithDay(leave.absentWithoutLeave.since, now)}`,
          tone: "danger",
        };
      } else if (leave) {
        where = "leave";
        // Late once the time has passed, as the patient pages count it (time audit T9).
        const late = leave.expectedReturn < now;
        whereabouts = {
          text: `${leave.kind === "medical_trip" ? "Medical trip" : "On leave"}, ${late ? "was due back" : "due back"} ${formatInstantWithDay(leave.expectedReturn, now)}`,
          tone: late ? "danger" : undefined,
        };
      } else if (admission.awayAtEmergencyDepartmentSince != null) {
        where = "ed";
        whereabouts = {
          text: `At an ED for ${splitDuration(Math.max(0, now - admission.awayAtEmergencyDepartmentSince))}`,
          tone: "warning",
        };
      }

      const plan: ClinicalFact | null = blockReason
        ? { text: `Held up: ${blockReason}`, tone: "warning" }
        : pastDate
          ? { text: "Past expected date", tone: "warning" }
          : expected !== null && expected !== undefined && !pulled
            ? {
                text: goingToday
                  ? `Home today ${formatInstantWithDay(expected, now)}`
                  : `Expected ${dayLabel(expected, now)}`,
              }
            : pulled
              ? null
              : { text: "No date set" };

      const arrivedToday = pulled || (admission.arrivedAt !== null && dayOf(admission.arrivedAt) === today);
      const row: WardClinicalRow = {
        key: admission.id,
        // A pulled bed not yet given a number reads "New", short enough for the bed column.
        bed:
          pulled && admission.bedNumber === undefined && !seats.has(admission.id)
            ? "New"
            : String(bedNumber).padStart(2, "0"),
        bedNumber,
        name: nameOf(movement ?? admission),
        dayNumber: days === null ? null : stayDayNumber(admission, now),
        where,
        obs: obsFact(admission.observation),
        constantObs: isConstantObservation(admission.observation),
        risks: riskWords(movement, admission.referralId, input),
        legal,
        whereabouts,
        plan,
        arrivedToday,
        goingToday,
        stuck: !goingToday && (heldUpByTomorrow || pastDate),
        attention: [],
      };
      row.attention = attentionFor(row, leave, now);
      return row;
    })
    .sort((left, right) => left.bedNumber - right.bedNumber || left.name.localeCompare(right.name));
}

function dayLabel(at: Instant, now: Instant): string {
  const days = dayOf(at) - dayOf(now);
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function attentionFor(row: WardClinicalRow, leave: LeaveBed | undefined, now: Instant) {
  const items: WardClinicalRow["attention"] = [];
  if (row.where === "awol") items.push({ group: "missing", text: row.whereabouts?.text ?? "", tone: "danger" });
  if (row.legal?.tone) items.push({ group: "legal", text: row.legal.text, tone: row.legal.tone });
  if (row.where === "leave" && leave && leave.expectedReturn - now <= TV_LEAVE_DUE_BACK_WINDOW_MINUTES)
    items.push({ group: "leave", text: row.whereabouts?.text ?? "", tone: row.whereabouts?.tone });
  if (row.constantObs) items.push({ group: "obs", text: row.obs.text, tone: "warning" });
  if (row.arrivedToday)
    items.push({
      group: "arrivals",
      text: row.where === "incoming" ? (row.whereabouts?.text ?? "") : "Arrived today",
      tone: undefined,
    });
  if (row.goingToday) items.push({ group: "going", text: row.plan?.text ?? "Home today", tone: undefined });
  if (row.stuck && row.plan) items.push({ group: "stuck", text: row.plan.text, tone: row.plan.tone ?? "warning" });
  return items;
}

/* --------------------------------------------------------------------------------------------- *
 * The ED clinical board: the ED handover table, read only, for a wall.
 * --------------------------------------------------------------------------------------------- */

export type EdClinicalRow = {
  id: string;
  name: string;
  bay: string;
  waitMinutes: number;
  band: "over" | "eight" | "under";
  urgency: 1 | 2 | 3;
  legal: ClinicalFact | null;
  /** A legal form is recorded on the journey (the ED board's "under a form"). */
  underForm: boolean;
  reviewed: boolean;
  noBedYet: boolean;
  obs: ClinicalFact;
  risks: string[];
  checks: ClinicalFact[];
  referral: ClinicalFact;
  next: ClinicalFact;
  /** Where the journey is on the way to a bed, for the Bed search board. */
  step: "review" | "bed" | "book" | "transport";
};

export type EdClinicalInputs = RecordInputs & {
  edId: string;
  units: readonly Unit[];
  now: Instant;
  accessTargetMinutes: number;
  nameOf: (movement: Movement) => string;
};

export function edClinicalRows(input: EdClinicalInputs): EdClinicalRow[] | undefined {
  const { edId, units, now, accessTargetMinutes } = input;
  const summary = edHomeSummaries(input.movements as Movement[], now, accessTargetMinutes).find(
    (row) => row.ed.id === edId,
  );
  if (!summary) return undefined;
  const bays = edBayAssignments(summary.open);
  const unitName = (id: string | undefined) =>
    id === undefined ? undefined : units.find((unit) => unit.id === id)?.name;

  return summary.open
    .map((movement): EdClinicalRow => {
      const waitMinutes = elapsedOpenMinutes(movement, now);
      const clearance = movementMedicalClearance(movement, input.referrals as Referral[]);
      // Checks read as plain words: on a wall of waiting people, colour is kept for what is late.
      const checks: ClinicalFact[] = [
        { text: clearance?.cleared ? "Medically cleared" : "Not yet cleared" },
        { text: movement.examination ? "Psychiatry reviewed" : "Not yet reviewed" },
      ];
      const band: EdClinicalRow["band"] =
        waitMinutes >= accessTargetMinutes
          ? "over"
          : waitMinutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES
            ? "eight"
            : "under";
      const accepted = unitName(movement.acceptedUnitId);
      const stage = ED_STAGE_LABELS[movement.stage];
      const referral: ClinicalFact = accepted
        ? { text: `${accepted}. ${stage}` }
        : movement.referredUnitIds.length > 0
          ? {
              text: `${stage}. Asked of ${movement.referredUnitIds.length} ${movement.referredUnitIds.length === 1 ? "ward" : "wards"}`,
            }
          : { text: stage, tone: band === "under" ? undefined : "warning" };
      const eta = movement.transport?.estimatedAt;
      const next: ClinicalFact =
        movement.transport?.collectedAt !== undefined
          ? { text: "Leaving now" }
          : movement.transport && movement.transport.cancelledAt === undefined
            ? { text: eta === undefined ? "Transport booked" : `Transport due ${formatInstantWithDay(eta, now)}` }
            : accepted
              ? { text: "Book transport", tone: "warning" }
              : !movement.examination
                ? { text: "Psychiatry review" }
                : { text: "Find a bed" };
      return {
        id: movement.id,
        name: input.nameOf(movement),
        bay: (bays.get(movement.id) ?? "").replace(/^Bay /, ""),
        waitMinutes,
        band,
        urgency: movement.urgency as 1 | 2 | 3,
        legal: legalFact(
          movement.legalStatus,
          movement,
          now,
          input.dayZero,
          input.thresholds,
          legalStatusesDiffer(movement, resolveSubjectPatient(movement, input).patient),
        ),
        underForm: isUnderAForm(movement),
        reviewed: movement.examination !== undefined,
        noBedYet: accepted === undefined,
        obs: obsFact(movement.observation),
        risks: riskWords(movement, movement.referralId, input),
        checks,
        referral,
        next,
        step:
          accepted === undefined
            ? movement.examination
              ? "bed"
              : "review"
            : movement.transport && movement.transport.cancelledAt === undefined
              ? "transport"
              : "book",
      };
    })
    .sort((left, right) => right.waitMinutes - left.waitMinutes || left.id.localeCompare(right.id));
}
