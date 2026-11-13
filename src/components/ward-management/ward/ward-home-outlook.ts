// WH3 (Josh, 4 Nov 2026): this ward's own outlook for tomorrow on Ward home. "Take the forecast
// behaviour and features and accounting for patients… show important information."
//
// No new maths. It is the Capacity bed forecast (`bedsForecast`) run on this one ward, the same way
// the bed board's "Your part in tomorrow's forecast" runs it (`wardForecastShare`), except that the
// people this ward has accepted and not yet pulled into a bed are passed in, so tomorrow's figure
// accounts for them. Booked planned admissions for this ward count through the same rule as the
// network figure. Every figure is this ward's own.
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { openBedReleases } from "@/components/ward-management/ward-bed-availability";
import { forecastReleaseAt } from "@/components/ward-management/forecast/forecast-release-date";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { wardDischargesDueToday } from "./ward-home-tab-model";

export type WardTomorrowOutlook = {
  /** The end of the window, 24 hours from now, as the Capacity forecast's "Tomorrow". */
  until: Instant;
  /** Ready beds left tomorrow after the people booked in: negative is a shortfall. */
  likely: number;
  /** The range's ends: confirmed discharges only, and everything on record going ahead. */
  low: number;
  high: number;
  /** Discharges likely by tomorrow: confirmed and expected, nothing holding them up. */
  likelyOut: number;
  /** Expected discharges in that count the ward has not confirmed yet. */
  unconfirmed: number;
  /** Planned discharge dates by tomorrow with no bed release flagged. Best case only. */
  notFlagged: number;
  /** People accepted for this ward and not in a bed yet, plus booked admissions due by tomorrow. */
  bookedIn: number;
  /**
   * Discharges the "Discharges today" card counts whose stay now carries a planned date after
   * tomorrow, so the forecast leaves them out of `likelyOut`. Counted from the same release
   * records (`wardDischargesDueToday`), never from the shown figures.
   */
  flaggedTodayPlannedLater: number;
};

/** Null for a closed ward, which the forecast counts as zero capacity. */
export function wardTomorrowOutlook(
  unit: Unit,
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  accepted: readonly Movement[],
  plannedAdmissions: readonly PlannedAdmission[],
  now: Instant,
): WardTomorrowOutlook | null {
  if (unit.isClosed) return null;
  const ownAdmissions = admissions.filter((admission) => admission.unitId === unit.id);
  const tomorrow = bedsForecast(
    [unit],
    releases.filter((release) => release.unitId === unit.id),
    ownAdmissions,
    [...accepted],
    now,
    plannedAdmissions.filter((booking) => booking.unitId === unit.id),
  ).horizons[0]!;
  const admissionsById = new Map(ownAdmissions.map((admission) => [admission.id, admission]));
  const flaggedTodayPlannedLater = wardDischargesDueToday(openBedReleases(releases, unit.id), now).filter(
    (release) => forecastReleaseAt(release, admissionsById.get(release.admissionId)) > tomorrow.until,
  ).length;
  return {
    until: tomorrow.until,
    likely: tomorrow.likely,
    low: tomorrow.low,
    high: tomorrow.high,
    likelyOut: tomorrow.confirmed + tomorrow.expected,
    unconfirmed: tomorrow.expected,
    notFlagged: tomorrow.plannedNotFlagged,
    bookedIn: tomorrow.bedsNeeded,
    flaggedTodayPlannedLater,
  };
}

/**
 * The headline figure's words: "1 short" or "0 free" (D-198: no "likely", numbers kept, as the
 * forecast line "Tomorrow N short · range … · From ward dates" reads). `lead` stays for callers.
 */
export function outlookHeadline(likely: number): { lead: string; figure: number; tail: string } {
  return likely < 0 ? { lead: "", figure: -likely, tail: "short" } : { lead: "", figure: likely, tail: "free" };
}

/** The out and in figures, D-198 words: "From ward dates: 0 out, 2 booked in" (no "likely"). */
export function outlookOutAndIn(outlook: Pick<WardTomorrowOutlook, "likelyOut" | "bookedIn">): string {
  return `From ward dates: ${outlook.likelyOut} out, ${outlook.bookedIn} booked in`;
}

/** What the ward can do to firm the figure up, such as "2 discharges unconfirmed", or null. */
export function outlookOpenWork(outlook: WardTomorrowOutlook): string | null {
  const open = [
    outlook.unconfirmed > 0
      ? `${outlook.unconfirmed} ${outlook.unconfirmed === 1 ? "discharge" : "discharges"} unconfirmed`
      : null,
    outlook.notFlagged > 0 ? `${outlook.notFlagged} ${outlook.notFlagged === 1 ? "date" : "dates"} not flagged` : null,
  ].filter((part): part is string => part !== null);
  return open.length === 0 ? null : open.join(", ");
}

/** The quiet note under the Tomorrow figures, such as "2 flagged for today now planned later", or null. */
export function outlookPlannedLaterNote(outlook: WardTomorrowOutlook): string | null {
  return outlook.flaggedTodayPlannedLater > 0
    ? `${outlook.flaggedTodayPlannedLater} flagged for today now planned later`
    : null;
}

/** The one plain line, D-198 words: "From ward dates: 1 short tomorrow. 2 discharges unconfirmed." */
export function outlookSentence(outlook: WardTomorrowOutlook): string {
  const head = outlookHeadline(outlook.likely);
  const lead = `From ward dates: ${head.figure} ${head.tail} tomorrow.`;
  const open = outlookOpenWork(outlook);
  return open === null ? lead : `${lead} ${open}.`;
}

/** The outlook from the live records, as Ward home reads them (`useWardFlowSelect`). */
export function useWardTomorrowOutlook(
  unit: Unit,
  accepted: readonly Movement[],
  now: Instant,
): WardTomorrowOutlook | null {
  const {
    bedReleases,
    admissions = [],
    plannedAdmissions = [],
  } = useWardFlowSelect("bedReleases", "admissions", "plannedAdmissions");
  return wardTomorrowOutlook(unit, bedReleases ?? [], admissions, accepted, plannedAdmissions, now);
}
