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
} from "@/components/ward-management/ed/ed-home-derivations";
import { edBayAssignments, movementMedicalClearance } from "@/components/ward-management/ed/ed-screen-model";
import { formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { riskFlagLabel } from "@/components/ward-management/referrals/referral-risk-flags";
import { dayOf, formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { admissionLegalStatus } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease, LeaveBed, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import {
  isConstantObservation,
  observationSummary,
  type Observation,
} from "@/components/ward-management/ward-observation";
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
  { id: "stuck", title: "Held up or past their date" },
] as const;
type HandoverGroup = (typeof HANDOVER_GROUPS)[number]["id"];

type RecordInputs = {
  movements: readonly Movement[];
  referrals: readonly Referral[];
  patients: readonly Patient[];
  plannedAdmissions?: readonly PlannedAdmission[];
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

const HOURS_24 = 24 * 60;

/** A legal form's line for the wall: the status, then the form and its end time as typed. */
function legalFact(status: string | undefined, movement: Movement | undefined, now: Instant): ClinicalFact | null {
  const form = movement?.legalForm;
  if (!form) return status ? { text: status } : null;
  const progression = formProgression(movement);
  if (progression)
    return { text: `Form ${progression.nextCode} to record, Form ${progression.endedCode} ended`, tone: "danger" };
  const head = `Form ${form.code}${status ? `, ${status.toLowerCase()}` : ""}`;
  if (form.dueAt === undefined) return { text: head };
  const left = form.dueAt - now;
  return {
    text: `${head}. ${typedTimeLine(form.dueAt, now)}`,
    tone: left <= 0 ? "danger" : left <= HOURS_24 ? "warning" : undefined,
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
      const status = admissionLegalStatus(
        {
          movements: input.movements as Movement[],
          patients: input.patients as Patient[],
          plannedAdmissions: input.plannedAdmissions as PlannedAdmission[] | undefined,
        },
        admission,
      );
      const legal = legalFact(status ?? movement?.legalStatus, movement, now);
      const release = bedReleases.find(
        (record) => record.admissionId === admission.id && record.state !== "discharged",
      );
      const blockReason = release?.blocker ?? admission.blockReason ?? null;
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
        const late = leave.expectedReturn <= now;
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
        dayNumber: days === null ? null : stayDayNumber(days),
        where,
        obs: obsFact(admission.observation),
        constantObs: isConstantObservation(admission.observation),
        risks: riskWords(movement, admission.referralId, input),
        legal,
        whereabouts,
        plan,
        arrivedToday,
        goingToday,
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
  if (row.where === "leave" && leave && leave.expectedReturn - now <= 12 * 60)
    items.push({ group: "leave", text: row.whereabouts?.text ?? "", tone: row.whereabouts?.tone });
  if (row.constantObs) items.push({ group: "obs", text: row.obs.text, tone: "warning" });
  if (row.arrivedToday)
    items.push({
      group: "arrivals",
      text: row.where === "incoming" ? (row.whereabouts?.text ?? "") : "Arrived today",
      tone: undefined,
    });
  if (row.goingToday) items.push({ group: "going", text: row.plan?.text ?? "Home today", tone: undefined });
  if (row.plan?.tone && !row.goingToday) items.push({ group: "stuck", text: row.plan.text, tone: row.plan.tone });
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
        waitMinutes >= accessTargetMinutes ? "over" : waitMinutes >= 480 ? "eight" : "under";
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
        legal: legalFact(movement.legalStatus, movement, now),
        underForm: movement.legalForm !== undefined,
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
