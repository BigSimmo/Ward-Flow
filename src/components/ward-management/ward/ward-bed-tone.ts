import type { WfTone } from "@/components/wf";
import type { BedHold } from "@/components/ward-management/ward-bed-hold";
import { deriveEddDriftBadge } from "@/components/ward-management/ward-discharge-dates";
import type { CriteriaLedChip } from "@/components/ward-management/ward-discharge-criteria";
import type { Observation } from "@/components/ward-management/ward-observation";

/*
 * The bed tile's data shape and its two small rules, kept apart from `ward-beds-matrix.tsx` so the
 * ward's first load (the Home tab, the bed drawer and the Bed board) can use them without pulling
 * in the Every bed grid, which loads only when it is opened (phone script budget, 19 October 2026).
 */

/**
 * Top 25 item 21: the badge for a discharge date the ward has moved several times (two or more).
 * Counts the ward's own date moves (`dischargeDateMoves`), never a measure of the person.
 */
export function eddMovedBadge(moves: number | null | undefined): string | null {
  if (typeof moves !== "number") return null;
  return deriveEddDriftBadge({ dischargeDateMoves: moves }).requiresConsultantReview
    ? `Date moved ${moves} times`
    : null;
}

export interface BedItem {
  bedNumber: number | string;
  bedLabel: string;
  status: unknown;
  statusText: string;
  patientAlias?: string;
  patientInfo?: {
    displayName?: string;
    umrn?: string;
    gender?: string;
    sex?: string;
    age?: number;
    homeRegion?: string;
  };
  umrn?: string;
  daysInBed?: number | string | null;
  stayDays?: number | null;
  stayBand?: string | null;
  pastDate?: boolean;
  awayAtEdHours?: number | null;
  isPulled?: boolean;
  isSelected?: boolean;
  isClosed?: boolean;
  podId?: string;
  podLabel?: string;
  designation?: string;
  isHdu?: boolean;
  /** True when the stay's observation level takes observation staff (a one-to-one or two staff level). */
  isSpecialling?: boolean;
  /** The stay's recorded observation level (fix plan item 10). Absent for a bed with nobody in it. */
  observation?: Observation;
  tentativeDiagnosis?: string;
  blockReason?: string;
  expectedDays?: number | null;
  legalStatusLabel?: string;
  /** Criteria led discharge on the tile (D-64), set only when the flag is on and criteria exist. */
  criteriaLedChip?: CriteriaLedChip | null;
  admissionId?: string;
  /**
   * The admission whose stay this bed shows, including a live pull (which `admissionId` leaves
   * out). The Bed board moves this stay with `PLACE_IN_BED`.
   */
  stayAdmissionId?: string;
  /** On a free bed held for an accepted referral (`heldBedNumber`): the person it is held for. */
  heldFor?: string;
  /** A4-24: a free bed vacated and still being made ready; not offered until someone taps Ready. */
  preparing?: boolean;
  age?: number | null;
  sex?: string | null;
  homeRegion?: string | null;
  /** How this person wants to be addressed, when that differs from the record name. */
  preferredName?: string;
  /** Gender recorded for bed placement. Never filled in from sex. */
  gender?: string;
  suburb?: string;
  generalPractitioner?: string;
  catchmentCommunityTeam?: string;
  highAcuity?: boolean;
  dischargeDateMoves?: number | null;
  /** True only when the ward has confirmed the discharge. Absent means not this person's bed. */
  dischargeConfirmed?: boolean | null;
  dischargeConfirmedBy?: string | null;
  /** The ward's own expected leaving time, already worded for this moment. */
  expectedDischargeLabel?: string | null;
  dischargeBarrier?: string | null;
  /**
   * Audit A1-3: a pulled bed's hold, from the one bed-hold rule (`ward-bed-hold.ts`). `lapsed`
   * is act now; `at-risk` (under an hour left) is the amber dot. Absent when no hold time is recorded.
   */
  bedHold?: BedHold | null;
  [key: string]: unknown;
}

/**
 * One shape per tone for a bed, shared by the Every bed tile and the bed drawer badge so the two
 * always agree: act now only for a held-up discharge, at risk for a bed past its date, away at an
 * ED or with a discharge barrier, moving for a bed on its way in or out, waiting for leave, done
 * for a free bed.
 */
export function bedGlyphTone(bed: BedItem): WfTone | null {
  if (bed.status === "ready") return bed.preparing ? "neutral" : "success";
  if (bed.status === "closed") return "closed";
  // Audit A3-1 (13 Oct 2026): a missing person is act now, never a neutral "On leave".
  if (bed.status === "leave" && bed.statusText === "Absent without leave") return "danger";
  if (bed.blockReason) return "danger";
  if (bed.awayAtEdHours != null || bed.pastDate || bed.dischargeBarrier) return "warning";
  const leaving = bed.dischargeConfirmed === true || (bed.expectedDays != null && bed.expectedDays <= 0);
  if (bed.status === "incoming" && bed.bedHold?.state === "lapsed") return "danger";
  if (bed.status === "incoming" && bed.bedHold?.state === "at-risk") return "warning";
  if (leaving || bed.status === "incoming") return "info";
  return bed.status === "leave" ? "neutral" : null;
}
