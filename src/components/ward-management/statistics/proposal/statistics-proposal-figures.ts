import { edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";
import { daysInBed, STAY_BANDS, type Admission } from "@/components/ward-management/ward-admissions";
import { bedStates, type BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";
import {
  HEALTH_SERVICES,
  type BedRelease,
  type HealthService,
  type LeaveBed,
  type Movement,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";

/**
 * Statistics redesign proposal (5 October 2026): ONE set of bed figures for every statistics view.
 *
 * Every bed number is the ruled four-box split from `bedStates` (Ready · Pulled · Closed ·
 * Occupied, which add up to the ward's beds). Occupancy is Occupied ÷ beds everywhere. The current
 * screens mix this with `unitCapacity().occupied` (which also counts pulled beds), which is why the
 * same 304 beds read 79.6%, 85.2% and 85.9% on different screens.
 */

export type BedFigures = BedStateCounts & { beds: number };

export type WardFigures = BedFigures & {
  unit: Unit;
  hospital: string;
  service: HealthService;
  occupancy: number;
  askedAndWaiting: number;
  averageStayDays: number | null;
};

export type ServiceFigures = BedFigures & {
  service: HealthService;
  occupancy: number;
  wards: WardFigures[];
  edWaiting: number;
  edLongestMinutes: number;
};

export type EdRow = {
  id: string;
  name: string;
  hospital: string;
  service: HealthService | null;
  waiting: number;
  urgent: number;
  unplaced: number;
  over24h: number;
  longestMinutes: number;
  medianMinutes: number;
};

const EMPTY: BedFigures = { beds: 0, ready: 0, pulled: 0, closed: 0, occupied: 0, beingMadeReady: 0, onLeave: 0 };

export function addFigures(a: BedFigures, b: BedFigures): BedFigures {
  return {
    beds: a.beds + b.beds,
    ready: a.ready + b.ready,
    pulled: a.pulled + b.pulled,
    closed: a.closed + b.closed,
    occupied: a.occupied + b.occupied,
    beingMadeReady: a.beingMadeReady + b.beingMadeReady,
    onLeave: a.onLeave + b.onLeave,
  };
}

export function occupancyOf(figures: BedFigures): number {
  return figures.beds > 0 ? figures.occupied / figures.beds : 0;
}

export function wardFigures(
  units: readonly Unit[],
  admissions: Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
  movements: readonly Movement[],
  now: Instant,
): WardFigures[] {
  return units.map((unit) => {
    const site = siteByCode(unit.siteCode);
    const states = bedStates(unit, admissions, bedReleases, leaveBeds);
    const figures: BedFigures = { ...states, beds: unit.beds };
    return {
      ...figures,
      unit,
      hospital: site?.name ?? unit.siteCode,
      service: site?.service ?? "Private",
      occupancy: occupancyOf(figures),
      askedAndWaiting: wardReferralTally(movements, unit.id).askedAndWaiting,
      averageStayDays: wardStatistics(unit.id, admissions, now).averageLengthOfStayDays,
    };
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function edRows(movements: readonly Movement[], now: Instant): EdRow[] {
  return allEmergencyDepartments().map((ed) => {
    const site = siteByCode(ed.siteCode);
    const figures = edWaitFigures(movements, ed.id, now);
    return {
      id: ed.id,
      name: ed.name,
      hospital: site?.name ?? ed.siteCode,
      service: site?.service ?? null,
      waiting: figures.onTheList,
      urgent: figures.urgent,
      unplaced: figures.unplaced,
      over24h: figures.over24h,
      longestMinutes: figures.longestWait?.waitMinutes ?? 0,
      medianMinutes: median(figures.waitingMovements.map((entry) => entry.waitMinutes)),
    };
  });
}

export function serviceFigures(wards: WardFigures[], eds: EdRow[]): ServiceFigures[] {
  return HEALTH_SERVICES.map((service) => {
    const own = wards.filter((ward) => ward.service === service);
    const totals = own.reduce<BedFigures>((sum, ward) => addFigures(sum, ward), EMPTY);
    const ownEds = eds.filter((ed) => ed.service === service);
    return {
      ...totals,
      service,
      occupancy: occupancyOf(totals),
      wards: own,
      edWaiting: ownEds.reduce((sum, ed) => sum + ed.waiting, 0),
      edLongestMinutes: ownEds.reduce((max, ed) => Math.max(max, ed.longestMinutes), 0),
    };
  });
}

export function networkFigures(wards: WardFigures[]): BedFigures {
  return wards.reduce<BedFigures>((sum, ward) => addFigures(sum, ward), EMPTY);
}

export type StayBandCount = { label: string; count: number };

/** People currently in a bed on this ward, grouped by the owner's four stay bands. */
export function stayBandCounts(unitId: string, admissions: readonly Admission[], now: Instant): StayBandCount[] {
  const current = admissions.filter((admission) => admission.unitId === unitId && admission.state === "occupied");
  return STAY_BANDS.map((band, index) => {
    const floor = index === 0 ? 0 : (STAY_BANDS[index - 1].upToDays ?? 0);
    const count = current.filter((admission) => {
      const days = daysInBed(admission, now);
      if (days === null) return false;
      return days >= floor && (band.upToDays === null || days < band.upToDays);
    }).length;
    return { label: band.label, count };
  });
}

export const SERVICE_COLOUR: Record<HealthService, string> = {
  "North Metro": "var(--svc-north)",
  "South Metro": "var(--svc-south)",
  "East Metro": "var(--svc-east)",
  WACHS: "var(--svc-wachs)",
  CAHS: "var(--svc-cahs)",
  Private: "var(--svc-private)",
};

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function hoursLabel(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, "0")}m`;
}

export function edShort(name: string): string {
  return name.replace(/ Emergency Department$/, "");
}

export type TodayReferrals = { raised: number; accepted: number; declined: number; open: number };

/** Referrals raised today that ask a psychiatric ward for a bed (same rules as the current screen). */
export function todayReferralFigures(referrals: readonly Referral[], now: Instant): TodayReferrals {
  const today = referrals.filter(
    (referral) =>
      dayOf(referral.raisedAt) === dayOf(now) &&
      referral.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward"),
  );
  const wardAsks = (referral: Referral) =>
    referral.destinations.filter((addressing) => addressing.destination.kind === "psychiatric_ward");
  return {
    raised: today.length,
    accepted: today.filter((referral) => wardAsks(referral).some((addressing) => addressing.state === "accepted"))
      .length,
    declined: today.filter((referral) =>
      wardAsks(referral).every((addressing) => addressing.state === "declined" && Boolean(addressing.declineReason)),
    ).length,
    open: today.filter((referral) => wardAsks(referral).some((addressing) => isAwaitingAnswer(addressing))).length,
  };
}
