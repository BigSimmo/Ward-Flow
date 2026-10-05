import {
  daysInBed,
  isPastExpectedDischarge,
  stayBand,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, LeaveBed, Movement } from "@/components/ward-management/ward-model";
import { edById } from "@/components/ward-management/ward-sites";

/**
 * Ward pages redesign proposal (5 October 2026). Everything a ward screen lists, derived once from
 * the shared state. Bed COUNTS come from the statistics proposal's `wardFigures` (the ruled
 * `bedStates` split); this file only lists the people and beds behind them, so a count and the list
 * under it are always the same records.
 */

/** No origin department: the ward does not see which ED asked until it answers (`ward-answer-view.tsx`). */
export type WardRequest = {
  movementId: string;
  waitedMinutes: number;
  urgent: boolean;
  sex: Movement["sex"];
  movement: Movement;
};

export type WardArrival = {
  movementId: string;
  edName: string;
  stage: Movement["stage"];
  sinceMinutes: number;
  movement: Movement;
};

export type WardDeparture = {
  release: BedRelease;
  band: ReleaseBand | "overdue";
  admission: Admission | undefined;
};

export type WardBed = {
  admission: Admission;
  days: number | null;
  stayLabel: string;
  pastDate: boolean;
  awayAtEd: boolean;
  onLeave: boolean;
  heldUp: boolean;
  leavingToday: boolean;
};

export type WardDetail = {
  requests: WardRequest[];
  arrivals: WardArrival[];
  departures: WardDeparture[];
  /** Occupied beds, longest stay first. The count always equals `bedStates().occupied`'s source rows. */
  beds: WardBed[];
  pastDate: WardBed[];
  heldUp: WardBed[];
  awayAtEd: WardBed[];
  leaving: { today: number; overdue: number; tomorrow: number; confirmedToday: number };
};

const TODAY_BANDS: readonly ReleaseBand[] = ["now", "by-midday", "by-1600", "tonight"];

/** Awaiting this ward's answer: the same rule the current answer screen uses (`ward-answer-view.tsx`). */
export function requestsFor(unitId: string, movements: readonly Movement[], now: Instant): WardRequest[] {
  return movements
    .filter(
      (movement) =>
        isOpen(movement) && movement.stage === "destination_review" && movement.referredUnitIds.includes(unitId),
    )
    .map((movement) => ({
      movementId: movement.id,
      waitedMinutes: Math.max(0, now - movement.openedAt),
      urgent: movement.flaggedUrgent,
      sex: movement.sex,
      movement,
    }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.waitedMinutes - a.waitedMinutes);
}

/** Accepted here and not yet arrived: accepted awaiting a bed, pulled, ready for handover or moving. */
export function arrivalsFor(unitId: string, movements: readonly Movement[], now: Instant): WardArrival[] {
  return movements
    .filter(
      (movement) =>
        isOpen(movement) &&
        movement.acceptedUnitId === unitId &&
        (movement.stage === "accepted_awaiting_bed" ||
          movement.stage === "pulled" ||
          movement.stage === "handover_ready" ||
          movement.stage === "moving"),
    )
    .map((movement) => ({
      movementId: movement.id,
      edName: edById(movement.originEdId)?.name ?? "Emergency department",
      stage: movement.stage,
      sinceMinutes: Math.max(0, now - (movement.acceptedAt ?? movement.openedAt)),
      movement,
    }));
}

export function wardDetail(
  unitId: string,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  leaveBeds: readonly LeaveBed[],
  movements: readonly Movement[],
  now: Instant,
): WardDetail {
  const onLeaveIds = new Set(leaveBeds.filter((bed) => bed.unitId === unitId).map((bed) => bed.admissionId));
  const openReleases = bedReleases.filter((release) => release.unitId === unitId && release.state !== "discharged");

  const departures: WardDeparture[] = [];
  const leavingToday = new Set<string>();
  const leaving = { today: 0, overdue: 0, tomorrow: 0, confirmedToday: 0 };
  for (const release of openReleases) {
    const raw = releaseBand(release, now);
    if (raw === "beyond-today") continue;
    // Same rule as the statistics proposal: an unconfirmed discharge dated on an earlier day is not
    // a bed anyone has said will come free, so it is listed as overdue and never counted as today.
    const band = release.state !== "confirmed" && dayOf(release.expectedAt) < dayOf(now) ? "overdue" : raw;
    departures.push({ release, band, admission: admissions.find((admission) => admission.id === release.admissionId) });
    if (band === "overdue") leaving.overdue += 1;
    else if (band === "tomorrow") leaving.tomorrow += 1;
    else if (TODAY_BANDS.includes(band)) {
      leaving.today += 1;
      leavingToday.add(release.admissionId);
      if (release.state === "confirmed") leaving.confirmedToday += 1;
    }
  }
  const bandOrder = ["overdue", ...TODAY_BANDS, "tomorrow"];
  departures.sort(
    (a, b) => bandOrder.indexOf(a.band) - bandOrder.indexOf(b.band) || a.release.expectedAt - b.release.expectedAt,
  );

  const beds: WardBed[] = admissions
    .filter((admission) => admission.unitId === unitId && admission.state === "occupied")
    .map((admission) => ({
      admission,
      days: daysInBed(admission, now),
      stayLabel: stayBand(admission, now)?.label ?? "Stay not recorded",
      pastDate: isPastExpectedDischarge(admission, now),
      awayAtEd: admission.awayAtEmergencyDepartmentSince !== null,
      onLeave: onLeaveIds.has(admission.id),
      heldUp: admission.blockReason !== null,
      leavingToday: leavingToday.has(admission.id),
    }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return {
    requests: requestsFor(unitId, movements, now),
    arrivals: arrivalsFor(unitId, movements, now),
    departures,
    beds,
    pastDate: beds.filter((bed) => bed.pastDate),
    heldUp: beds.filter((bed) => bed.heldUp),
    awayAtEd: beds.filter((bed) => bed.awayAtEd),
    leaving,
  };
}

/** "3 h 20 min", "45 min", "2 d 4 h": a waiting time, never a legal limit. */
export function waitedLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${Math.round(minutes % 60)} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export const ARRIVAL_STAGE_LABEL: Partial<Record<Movement["stage"], string>> = {
  accepted_awaiting_bed: "Accepted, waiting for a bed",
  pulled: "Bed given, not yet travelling",
  handover_ready: "Ready for handover",
  moving: "Travelling",
};

export const DEPARTURE_BAND_LABEL: Record<WardDeparture["band"], string> = {
  overdue: "Date passed, not confirmed",
  now: "Due now",
  "by-midday": "By midday",
  "by-1600": "By 16:00",
  tonight: "Tonight",
  tomorrow: "Tomorrow",
};
