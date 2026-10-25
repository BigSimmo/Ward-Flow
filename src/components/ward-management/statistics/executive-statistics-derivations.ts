import { wardStatistics } from "../ward-statistics";
import { edWaitBands, edWaitFigures } from "./statistics-ed-waits";
import { pilotMeasures, type DurationSummary } from "../reports/pilot-measures";
import { reportWeek, weeklyOperationsReport, type WeeklyReportInput } from "../reports/weekly-report";
import type {
  ExecutiveReportingEd,
  ExecutiveReportingWard,
  ExecutiveReportingWeek,
} from "./executive-statistics-contract";

/** Inactive release-graph limit, not the final UI policy. True zeroes remain zeroes. */
export function withheldReportingCount(value: number): { kind: "exact"; value: 0 } | { kind: "withheld" } {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid reporting count.");
  return value === 0 ? { kind: "exact", value: 0 } : { kind: "withheld" };
}

export function executiveWardSummary(
  ward: Omit<ExecutiveReportingWard, "statistics">,
  admissions: WeeklyReportInput["admissions"],
  now: WeeklyReportInput["now"],
): ExecutiveReportingWard {
  const stats = wardStatistics(ward.id, [...admissions], now);
  return {
    ...ward,
    statistics: {
      averageLengthOfStayDays: stats.averageLengthOfStayDays,
      averageEmptyBedMinutes: stats.averageEmptyBedMinutes,
      emptyBedMinutesShortest: stats.emptyBedMinutesShortest,
      emptyBedMinutesLongest: stats.emptyBedMinutesLongest,
      averageWaitlistWaitMinutes: stats.averageWaitlistWaitMinutes,
      lengthOfStayIncoherentCount: withheldReportingCount(stats.lengthOfStayIncoherentCount),
      emptyBedIncoherentCount: withheldReportingCount(stats.emptyBedIncoherentCount),
      readyToLeaveCannot: withheldReportingCount(stats.readyToLeaveCannot),
      longStays: withheldReportingCount(stats.longStays),
      dischargeDateOutcomes: {
        met: withheldReportingCount(stats.dischargeDateOutcomes.met),
        missed: withheldReportingCount(stats.dischargeDateOutcomes.missed),
        moved: withheldReportingCount(stats.dischargeDateOutcomes.moved),
        consideredCount: withheldReportingCount(stats.dischargeDateOutcomes.consideredCount),
      },
    },
  };
}

export function executiveEdSummary(
  ed: Pick<ExecutiveReportingEd, "id" | "name" | "siteCode" | "service">,
  movements: WeeklyReportInput["movements"],
  now: WeeklyReportInput["now"],
): ExecutiveReportingEd {
  const figures = edWaitFigures(movements, ed.id, now);
  return {
    ...ed,
    onTheList: withheldReportingCount(figures.onTheList),
    urgent: withheldReportingCount(figures.urgent),
    unplaced: withheldReportingCount(figures.unplaced),
    over24h: withheldReportingCount(figures.over24h),
    over48h: withheldReportingCount(figures.over48h),
    longestWaitMinutes: figures.longestWait?.waitMinutes ?? null,
    bands: edWaitBands(movements, ed.id, now).map((band) => ({
      label: band.label,
      count: withheldReportingCount(band.count),
    })),
  };
}

function durationSummary(summary: DurationSummary) {
  return {
    median: summary.median ?? null,
    p90: summary.p90 ?? null,
    sampleSize: withheldReportingCount(summary.sampleSize),
    population: withheldReportingCount(summary.population),
  };
}

/** All operational rows and stored reason strings stop at this private selector boundary. */
export function executiveWeeklySummaries(
  input: WeeklyReportInput,
  dayZero: string,
  pullHoldMinutes: number,
): ExecutiveReportingWeek[] {
  return [-1, 0, 1, 2, 3, 4, 5, 6, 7].map((offset) => {
    const week = reportWeek(offset, input.now, new Date(dayZero));
    const report = weeklyOperationsReport(input, week);
    const pilot = pilotMeasures(
      {
        movements: input.movements,
        referrals: input.referrals,
        patients: input.patients,
        now: input.now,
        pullHoldMinutes,
      },
      week,
    );
    return {
      week,
      report: {
        edWaits: {
          targetMinutes: report.edWaits.targetMinutes,
          count: withheldReportingCount(report.edWaits.count),
          longestMinutes: report.edWaits.longestMinutes,
        },
        outOfArea: { bedDays: report.outOfArea.bedDays, people: withheldReportingCount(report.outOfArea.people) },
        delayedDischarge: {
          bedDays: report.delayedDischarge.bedDays,
          people: withheldReportingCount(report.delayedDischarge.people),
          recordedFrom: report.delayedDischarge.recordedFrom,
          unmeasuredStays: withheldReportingCount(report.delayedDischarge.unmeasuredStays),
        },
        declines: {
          placement: withheldReportingCount(report.declines.placement),
          referral: withheldReportingCount(report.declines.referral),
        },
        overrides: {
          placement: withheldReportingCount(report.overrides.placement),
          referral: withheldReportingCount(report.overrides.referral),
        },
        occupancy: {
          beds: report.occupancy.beds,
          occupiedBedDays: report.occupancy.occupiedBedDays,
          averagePercent: report.occupancy.averagePercent,
          now: { ...report.occupancy.now },
        },
      },
      pilot: {
        requestToBedHeld: durationSummary(pilot.requestToBedHeld),
        steps: pilot.steps.map((step) => ({ id: step.id, summary: durationSummary(step.summary) })),
        requests: {
          raised: withheldReportingCount(pilot.requests.raised),
          noWardAsked: withheldReportingCount(pilot.requests.noWardAsked),
          duplicates: withheldReportingCount(pilot.requests.duplicates),
          windowMinutes: pilot.requests.windowMinutes,
        },
        holds: {
          held: withheldReportingCount(pilot.holds.held),
          ranOut: withheldReportingCount(pilot.holds.ranOut),
          givenBack: withheldReportingCount(pilot.holds.givenBack),
        },
        transport: {
          collectedToArrived: durationSummary(pilot.transport.collectedToArrived),
          lateCollections: withheldReportingCount(pilot.transport.lateCollections),
          collections: withheldReportingCount(pilot.transport.collections),
          cancelled: withheldReportingCount(pilot.transport.cancelled),
        },
        completeness: {
          arrivals: withheldReportingCount(pilot.completeness.arrivals),
          complete: withheldReportingCount(pilot.completeness.complete),
        },
      },
    };
  });
}
