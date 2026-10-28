import type { WardFlowState } from "../ward-flow-reducer";
import { wardStatistics } from "../ward-statistics";
import { bedIsOccupied, STAY_BANDS, stayBand } from "../ward-admissions";
import { dayOf, MINUTES_PER_DAY, isClockBreached } from "../ward-clock";
import { openBedsNow, bedsPendingPreparation } from "../ward-bed-availability";
import { dischargeDateCoverage } from "./statistics-ward-discharge-dates";
import { readyNotYetGone } from "./statistics-ward-ready";
import { wardReferralTally } from "./statistics-ward-referrals";
import { ED_WAIT_BANDS, edJourneyWaitBands, edJourneyWaitFigures, edWaitFigures } from "./statistics-ed-waits";
import { declinesByReason } from "./statistics-derivations";
import { pilotMeasures, type DurationSummary } from "../reports/pilot-measures";
import { reportWeek, weeklyOperationsReport, type WeeklyReportInput } from "../reports/weekly-report";
import { ExecutiveCountRelease, type ReportingCount } from "./executive-statistics-release";
import type { ExecutiveBedCounts } from "./executive-statistics-contract";
import { DECLINE_REASONS } from "../ward-model";
import { OVERRIDE_REASONS } from "../ward-change-reasons";
import { DECLINE_REASON_LABELS } from "../ward-referrals";
import { UNKNOWN_DECLINE_REASON_LABEL } from "../reports/weekly-report";
import { HEALTH_SERVICES, type Unit } from "../ward-model";
import type { PlaceLookup } from "../ward-role-access";
import {
  COMMUNITY_TEAM_PAGES,
  communityHubLists,
  communityMembershipResolution,
} from "../community/community-derivations";
import { communityFigures } from "./statistics-community-figures";
import { isPastDate } from "./statistics-dates";
import { OUT_OF_AREA_BANDS, TRAVEL_BAND_LABELS } from "../ward-distance";
import { outOfAreaLedger } from "../ward-referrals";
import { siteByCode } from "../ward-sites";
import { BED_ALERT_THRESHOLD_PERCENT } from "../shell/ward-service-bed-alerts";
import { blockedDischargesByReason } from "./statistics-derivations";
import { isOpen, unitCapacity } from "../ward-derivations";
import { LONG_WAIT_MINUTES, ED_SEVERE_PRESSURE_WAIT_MINUTES } from "../ward-operational-defaults";
import { stageCopy } from "../ward-stage-copy";
import { sessionTrends } from "./statistics-session-trends";
import type { EventLogEntry } from "../ward-event-log";
import { edJourneySummaries } from "../ed/ed-home-derivations";
import { MINIMUM_EFFECTIVENESS_SAMPLE } from "../ward-derivations-records";
import { readyBedsNow } from "../ward-bed-states";
import { lockedBedsFree, openBedsFree } from "../ward-bed-designation";

function stayDays(arrivedAt: number | null, now: number): number | null {
  return arrivedAt === null || arrivedAt > now ? null : Math.floor((now - arrivedAt) / MINUTES_PER_DAY);
}

export type ExecutivePrivateInput = WeeklyReportInput &
  Pick<WardFlowState, "morningRollupConfirmations"> & {
    pullHoldMinutes: number;
    morningRollupDeadlineMinutes: number;
  };
type PublicWard = {
  id: string;
  name: string;
  siteCode: string;
  service: import("../ward-model").HealthService;
  beds: ExecutiveBedCounts;
};

export function executiveWardSummary(ward: PublicWard, input: ExecutivePrivateInput, release: ExecutiveCountRelease) {
  const now = input.now;
  const unit = input.units.find((entry) => entry.id === ward.id)!;
  const statistics = wardStatistics(ward.id, [...input.admissions], now);
  const key = (suffix: string) => `ward:${ward.id}:${suffix}`;
  const c = (suffix: string, value: number) => release.count(key(suffix), value);
  const currentRows = input.admissions.filter((row) => row.unitId === ward.id && row.state !== "departed");
  const current = c("current", currentRows.length);
  const blocked = c("blocked", currentRows.filter((row) => row.blockReason !== null).length);
  release.subset(current, blocked);
  const stayBands = STAY_BANDS.map((band) => ({
    id: band.id,
    label: band.label,
    count: c(`stay:${band.id}`, currentRows.filter((row) => stayBand(row, now)?.id === band.id).length),
  }));
  const unrecordedStay = c("stay:unrecorded", currentRows.filter((row) => stayBand(row, now) === null).length);
  release.partition(current, [...stayBands.map((band) => band.count), unrecordedStay]);
  const dueByDay = Array.from({ length: 7 }, (_, offset) => ({
    offset,
    count: c(
      `due:${offset}`,
      currentRows.filter(
        (row) =>
          row.state !== "pulled" &&
          row.expectedDischargeAt !== null &&
          row.expectedDischargeAt >= now &&
          dayOf(row.expectedDischargeAt) === dayOf(now) + offset,
      ).length,
    ),
  }));
  const dueThisWeek = c(
    "due:week",
    currentRows.filter(
      (row) =>
        row.state !== "pulled" &&
        row.expectedDischargeAt !== null &&
        row.expectedDischargeAt >= now &&
        dayOf(row.expectedDischargeAt) >= dayOf(now) &&
        dayOf(row.expectedDischargeAt) < dayOf(now) + 7,
    ).length,
  );
  release.partition(
    dueThisWeek,
    dueByDay.map((day) => day.count),
  );
  release.subset(current, dueThisWeek);
  const coverage = dischargeDateCoverage(
    input.admissions.filter((row) => row.state !== "pulled"),
    ward.id,
  );
  const withDate = c("withDate", coverage.recorded);
  const withoutDate = c("withoutDate", coverage.notRecorded);
  const coverageTotal = c("datePopulation", coverage.population);
  release.partition(coverageTotal, [withDate, withoutDate]);
  let readyToLeave: {
    state: "measured" | "unavailable";
    total: ReturnType<typeof c> | null;
    byReason: { reason: string; count: ReturnType<typeof c> }[];
  };
  try {
    const ready = readyNotYetGone(input.admissions, ward.id);
    const total = c("blocked", ready.total);
    readyToLeave = {
      state: "measured",
      total,
      byReason: ready.tallies.map((entry) => ({
        reason: entry.reason,
        count: c(`ready:${entry.reason}`, entry.count),
      })),
    };
    release.partition(
      total,
      readyToLeave.byReason.map((entry) => entry.count),
    );
    release.subset(current, total);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith("blockedDischargesByReason:")) throw error;
    // Preserve a genuine selector refusal without serialising its record-bearing error message.
    readyToLeave = { state: "unavailable", total: null, byReason: [] };
  }
  const dischargeDateOutcomes = {
    met: c("date:met", statistics.dischargeDateOutcomes.met),
    missed: c("date:missed", statistics.dischargeDateOutcomes.missed),
    moved: c("date:moved", statistics.dischargeDateOutcomes.moved),
    consideredCount: c("date:considered", statistics.dischargeDateOutcomes.consideredCount),
  };
  release.partition(dischargeDateOutcomes.consideredCount, [dischargeDateOutcomes.met, dischargeDateOutcomes.missed]);
  const stays = currentRows
    .filter(bedIsOccupied)
    .map((row) => stayDays(row.arrivedAt, now))
    .filter((value): value is number => value !== null);
  const longStays = c("longStays", statistics.longStays);
  const longStayBand = stayBands.find((band) => band.id === "over-3-months");
  if (longStayBand) release.partition(longStays, [longStayBand.count]);
  const referralFigures = wardReferralTally(input.movements, ward.id);
  const askedAndWaiting = c("awaitingAnswer", referralFigures.askedAndWaiting);
  const askedAndWaitingOpen = c(
    "awaitingAnswer:open",
    wardReferralTally(input.movements.filter(isOpen), ward.id).askedAndWaiting,
  );
  const everAccepted = c("referrals:accepted", referralFigures.everAccepted);
  const everDeclined = c("referrals:declined", referralFigures.everDeclined);
  const recordedMovements = release.count("movements:recorded", input.movements.length, 0);
  for (const count of [askedAndWaiting, everAccepted, everDeclined]) release.subset(recordedMovements, count);
  release.subset(askedAndWaiting, askedAndWaitingOpen);
  const leaveIds = new Set(input.leaveBeds.filter((bed) => bed.unitId === ward.id).map((bed) => bed.admissionId));
  const occupiedRows = currentRows.filter((row) => row.state === "occupied");
  const onLeave = occupiedRows.filter((row) => leaveIds.has(row.id)).length;
  const inBed = occupiedRows.length - onLeave;
  const pulled = currentRows.filter((row) => row.state === "pulled").length;
  const pendingPreparation = bedsPendingPreparation(unit.id, input.bedReleases);
  const prepFromReady = Math.min(pendingPreparation, ward.beds.ready);
  const prepFromClosed = Math.min(pendingPreparation - prepFromReady, ward.beds.closed);
  const bedMapCounts = {
    occupied: Math.max(0, ward.beds.occupied - ward.beds.onLeave),
    leave: ward.beds.onLeave,
    pulled: ward.beds.pulled,
    ready: ward.beds.ready - prepFromReady,
    prep: prepFromReady + prepFromClosed,
    closed: ward.beds.closed - prepFromClosed,
  };
  const unplacedBedMapRecords = c(
    "unplacedBedMapRecords",
    Math.max(
      0,
      inBed +
        onLeave +
        pulled -
        Math.min(inBed, bedMapCounts.occupied) -
        Math.min(onLeave, bedMapCounts.leave) -
        Math.min(pulled, bedMapCounts.pulled),
    ),
  );
  // The current-occupant whole-day mean below and the historical ward mean remain separate.
  // The long-stay count above shares current membership with its named stay band.
  const pulledWaits = currentRows
    .filter((row) => row.state === "pulled" && row.pulledAt !== null && row.pulledAt <= now)
    .map((row) => now - row.pulledAt!);
  const finderReady = readyBedsNow(unit, input.admissions, input.bedReleases);
  return {
    ...ward,
    cohort: unit.cohort,
    authorised: unit.authorised,
    lockedBeds: unit.lockedBeds,
    // Public inventory facts preserve the existing bed-finder controls without a Unit record.
    isClosed: unit.isClosed === true,
    sexDesignation: unit.sexDesignation,
    confirmedAt: unit.allocatable.confirmedAt,
    lockedReady: Math.min(lockedBedsFree(unit), finderReady),
    openReady: Math.min(openBedsFree(unit), finderReady),
    openNow: openBedsNow(unit, input.bedReleases),
    capacityReady: unitCapacity(unit, input.bedReleases).available,
    empty: unit.empty.value,
    allocatable: unit.allocatable.value,
    pendingPreparation: bedsPendingPreparation(unit.id, input.bedReleases),
    current,
    blocked,
    awaitingAnswer: askedAndWaiting,
    referrals: { askedAndWaiting, askedAndWaitingOpen, everAccepted, everDeclined },
    bedMapCounts,
    unplacedBedMapRecords,
    oldestPulledMinutes: pulledWaits.length ? Math.max(...pulledWaits) : null,
    longestStayDays: stays.length ? Math.max(...stays) : null,
    meanCurrentStayDays: stays.length ? stays.reduce((sum, value) => sum + value, 0) / stays.length : null,
    stayBands,
    unrecordedStay,
    dueByDay,
    dueThisWeek,
    dischargedToday: c(
      "dischargedToday",
      input.admissions.filter(
        (row) => row.unitId === ward.id && row.leftAt !== null && dayOf(row.leftAt) === dayOf(now),
      ).length,
    ),
    dueToday: dueByDay[0]!.count,
    dischargeDates: { withDate, withoutDate },
    readyToLeave,
    statistics: {
      averageLengthOfStayDays: statistics.averageLengthOfStayDays,
      averageEmptyBedMinutes: statistics.averageEmptyBedMinutes,
      emptyBedMinutesShortest: statistics.emptyBedMinutesShortest,
      emptyBedMinutesLongest: statistics.emptyBedMinutesLongest,
      averageWaitlistWaitMinutes: statistics.averageWaitlistWaitMinutes,
      lengthOfStayIncoherentCount: c("stay:incoherent", statistics.lengthOfStayIncoherentCount),
      emptyBedIncoherentCount: c("empty:incoherent", statistics.emptyBedIncoherentCount),
      readyToLeaveCannot: c("blocked", statistics.readyToLeaveCannot),
      longStays,
      dischargeDateOutcomes,
    },
  };
}

export function executiveEdSummary(
  ed: Omit<PublicWard, "beds">,
  input: ExecutivePrivateInput,
  release: ExecutiveCountRelease,
) {
  const figures = edJourneyWaitFigures(input.movements, ed.id, input.now);
  const physical = edWaitFigures(input.movements, ed.id, input.now);
  const c = (suffix: string, value: number) => release.count(`ed:${ed.id}:${suffix}`, value);
  const total = c("waiting", figures.onTheList);
  const bands = edJourneyWaitBands(input.movements, ed.id, input.now).map((band) => ({
    label: band.label,
    count: c(`band:${band.label}`, band.count),
  }));
  release.partition(
    total,
    bands.map((band) => band.count),
  );
  const urgent = c("urgent", figures.urgent);
  const unplaced = c("unplaced", figures.unplaced);
  const over24h = c("over24h", figures.over24h);
  const over48h = c("over48h", figures.over48h);
  const over8h = c(
    "over8h",
    figures.waitingMovements.filter((entry) => entry.waitMinutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES).length,
  );
  release.subset(total, urgent);
  release.subset(total, unplaced);
  release.subset(total, over24h);
  release.subset(over24h, over48h);
  release.subset(total, over8h);
  release.subset(over8h, over24h);
  if (ED_WAIT_BANDS.some((band) => band.fromMinutes === ED_SEVERE_PRESSURE_WAIT_MINUTES))
    release.partition(
      over8h,
      bands
        .filter((_, index) => ED_WAIT_BANDS[index]!.fromMinutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES)
        .map((band) => band.count),
    );
  if (ED_WAIT_BANDS.some((band) => band.fromMinutes === LONG_WAIT_MINUTES))
    release.partition(
      over24h,
      bands.filter((_, index) => ED_WAIT_BANDS[index]!.fromMinutes >= LONG_WAIT_MINUTES).map((band) => band.count),
    );
  const physicalWaiting = c("physicalWaiting", physical.onTheList);
  release.subset(total, physicalWaiting);
  const waits = figures.waitingMovements.map((entry) => entry.waitMinutes).sort((a, b) => a - b);
  const medianWaitMinutes = !waits.length
    ? null
    : waits.length % 2
      ? waits[Math.floor(waits.length / 2)]!
      : (waits[waits.length / 2 - 1]! + waits[waits.length / 2]!) / 2;
  const declines = declinesByReason([...figures.allDepartmentMovements]);
  const declineTotal = c("declines", declines.totalCount);
  const byReason = declines.tallies.map((entry) => ({
    reason: entry.reason,
    count: c(`decline:${entry.reason}`, entry.count),
  }));
  release.subset(
    declineTotal,
    release.sum(
      `ed:${ed.id}:classifiedDeclines`,
      byReason.map((entry) => entry.count),
    ),
  );
  const noFree = figures.allDepartmentMovements
    .flatMap((movement) => movement.declines)
    .filter((decline) => decline.reason === "no_suitable_bed").length;
  const noFreeBed = c("declines:noFreeBed", noFree);
  const notSuitable = declines.totalCount >= noFree ? c("declines:notSuitable", declines.totalCount - noFree) : null;
  if (notSuitable) release.partition(declineTotal, [noFreeBed, notSuitable]);
  const journey = edJourneySummaries(input.movements, input.now).find((summary) => summary.ed.id === ed.id)!;
  const stillInEd = c("stillInEd", journey.stillInEd);
  const inTransit = c("inTransit", journey.inTransit);
  release.partition(total, [stillInEd, inTransit]);
  release.subset(stillInEd, physicalWaiting);
  const legalClockBreachedCount = c(
    "legalClockBreached",
    figures.departmentMovements.filter(
      (movement) => movement.legalForm?.dueAt !== undefined && isClockBreached(movement.legalForm.dueAt, input.now),
    ).length,
  );
  release.subset(total, legalClockBreachedCount);
  return {
    ...ed,
    onTheList: total,
    urgent,
    unplaced,
    over8h,
    over24h,
    over48h,
    longestWaitMinutes: figures.longestWait?.waitMinutes ?? null,
    medianWaitMinutes,
    bands,
    physicalWaiting,
    physicalLongestWaitMinutes: physical.longestWait?.waitMinutes ?? null,
    stillInEd,
    inTransit,
    legalClockBreachedCount,
    declines: { total: declineTotal, noFreeBed, notSuitable, byReason },
  };
}

function durationSummary(summary: DurationSummary, key: string, release: ExecutiveCountRelease) {
  const sampleSize = release.count(`${key}:sample`, summary.sampleSize);
  const population = release.count(`${key}:population`, summary.population);
  release.subset(population, sampleSize);
  // summariseDurations filters finite nonnegative samples and publishes BOTH summaries iff
  // sampleSize reaches this existing floor. Preserve its observable count bounds privately.
  if (summary.median === undefined && summary.p90 === undefined)
    release.bounds(sampleSize, 0, MINIMUM_EFFECTIVENESS_SAMPLE - 1);
  else release.bounds(sampleSize, MINIMUM_EFFECTIVENESS_SAMPLE);
  return { median: summary.median ?? null, p90: summary.p90 ?? null, sampleSize, population };
}

/** Current selectors run privately. Rows, subject IDs, source errors and typed reasons stop here. */
export function executiveWeeklySummaries(
  input: ExecutivePrivateInput,
  dayZero: string,
  release: ExecutiveCountRelease,
) {
  return [-1, 0, 1, 2, 3, 4, 5, 6, 7].map((offset) => {
    const week = reportWeek(offset, input.now, new Date(dayZero));
    const report = weeklyOperationsReport(input, week);
    const pilot = pilotMeasures(input, week);
    const key = `week:${offset}`;
    const c = (suffix: string, value: number) => release.count(`${key}:${suffix}`, value);
    const d = (summary: DurationSummary, suffix: string) => durationSummary(summary, `${key}:${suffix}`, release);
    const reasons = (values: { reason: string; count: number }[], suffix: string, vocabulary: readonly string[]) => {
      const allowed = [...new Set([...vocabulary, UNKNOWN_DECLINE_REASON_LABEL])];
      const tally = new Map(allowed.map((reason) => [reason, 0]));
      for (const entry of values) {
        const reason = tally.has(entry.reason) ? entry.reason : UNKNOWN_DECLINE_REASON_LABEL;
        tally.set(reason, tally.get(reason)! + entry.count);
      }
      return allowed.map((reason) => ({ reason, count: c(`${suffix}:${reason}`, tally.get(reason)!) }));
    };
    const declines = {
      placement: c("declines:placement", report.declines.placement),
      referral: c("declines:referral", report.declines.referral),
      byReason: reasons(
        report.declines.byReason,
        "declines",
        DECLINE_REASONS.map((reason) => DECLINE_REASON_LABELS[reason]),
      ),
    };
    const overrides = {
      placement: c("overrides:placement", report.overrides.placement),
      referral: c("overrides:referral", report.overrides.referral),
      byReason: reasons(report.overrides.byReason, "overrides", OVERRIDE_REASONS),
    };
    release.partition(c("declines:total", report.declines.placement + report.declines.referral), [
      declines.placement,
      declines.referral,
    ]);
    release.partition(c("overrides:total", report.overrides.placement + report.overrides.referral), [
      overrides.placement,
      overrides.referral,
    ]);
    // Unknown imported reason strings collapse to the existing unknown label, never typed text.
    release.partition(
      c("declines:total", report.declines.placement + report.declines.referral),
      declines.byReason.map((entry) => entry.count),
    );
    release.partition(
      c("overrides:total", report.overrides.placement + report.overrides.referral),
      overrides.byReason.map((entry) => entry.count),
    );
    const requests = {
      raised: c("requests:raised", pilot.requests.raised),
      noWardAsked: c("requests:noWardAsked", pilot.requests.noWardAsked),
      duplicates: c("requests:duplicates", pilot.requests.duplicates),
      windowMinutes: pilot.requests.windowMinutes,
    };
    release.subset(requests.raised, requests.noWardAsked);
    release.subset(requests.raised, requests.duplicates);
    const holds = {
      held: c("holds:held", pilot.holds.held),
      ranOut: c("holds:ranOut", pilot.holds.ranOut),
      givenBack: c("holds:givenBack", pilot.holds.givenBack),
    };
    release.subset(holds.held, holds.ranOut);
    release.subset(holds.held, holds.givenBack);
    const transport = {
      collectedToArrived: d(pilot.transport.collectedToArrived, "transport:duration"),
      lateCollections: c("transport:late", pilot.transport.lateCollections),
      collections: c("transport:collections", pilot.transport.collections),
      cancelled: c("transport:cancelled", pilot.transport.cancelled),
    };
    release.subset(transport.collections, transport.lateCollections);
    const completeness = {
      arrivals: c("completeness:arrivals", pilot.completeness.arrivals),
      complete: c("completeness:complete", pilot.completeness.complete),
    };
    release.subset(completeness.arrivals, completeness.complete);
    const requestToArrival = d(pilot.requestToArrival, "requestToArrival");
    const requestToBedHeld = d(pilot.requestToBedHeld, "requestToBedHeld");
    const steps = pilot.steps.map((step) => ({ id: step.id, summary: d(step.summary, `step:${step.id}`) }));
    // These are the same arrival/first-pull populations, not merely equal observed values.
    release.partition(completeness.arrivals, [requestToArrival.population]);
    release.partition(completeness.arrivals, [steps.find((step) => step.id === "travel")!.summary.population]);
    release.partition(requestToBedHeld.population, [steps.find((step) => step.id === "hold")!.summary.population]);
    release.subset(completeness.arrivals, transport.collectedToArrived.population);
    return {
      week,
      report: {
        edWaits: {
          targetMinutes: report.edWaits.targetMinutes,
          count: c("edWaits", report.edWaits.count),
          longestMinutes: report.edWaits.longestMinutes,
        },
        outOfArea: { bedDays: report.outOfArea.bedDays, people: c("outOfArea", report.outOfArea.people) },
        delayedDischarge: {
          bedDays: report.delayedDischarge.bedDays,
          people: c("delayedDischarge", report.delayedDischarge.people),
          recordedFrom: report.delayedDischarge.recordedFrom,
          unmeasuredStays: c("unmeasuredStays", report.delayedDischarge.unmeasuredStays),
        },
        declines,
        overrides,
        occupancy: { ...report.occupancy, now: { ...report.occupancy.now } },
      },
      pilot: {
        requestToArrival,
        bedFigures: { ...pilot.bedFigures },
        requestToBedHeld,
        steps,
        requests,
        holds,
        transport,
        completeness,
      },
    };
  });
}

export function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  return !sorted.length
    ? null
    : sorted.length % 2
      ? sorted[Math.floor(sorted.length / 2)]!
      : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
}

const serviceCodes = { NMHS: "North Metro", SMHS: "South Metro", EMHS: "East Metro", WACHS: "WACHS" } as const;
/** Pure service-code extraction of the existing clinic mapping; parity is tested against its UI source. */
export function executiveCommunityService(name: string) {
  const norm = name.trim().toLowerCase();
  const code =
    norm.startsWith("alma street") ||
    norm === "fremantle" ||
    ["peel", "rockingham", "kwinana"].some((part) => norm.includes(part))
      ? "SMHS"
      : ["armadale", "mead", "eudoria", "bentley", "mills street", "midland", "midalnd", "swan", "inner city"].some(
            (part) => norm.includes(part),
          ) || norm === "icc"
        ? "EMHS"
        : ["joondalup", "clarkson", "mirrabooka", "osborne", "subiaco"].some((part) => norm.includes(part))
          ? "NMHS"
          : "WACHS";
  return { code, service: serviceCodes[code] };
}

export function executiveTeams(input: ExecutivePrivateInput, release: ExecutiveCountRelease) {
  return COMMUNITY_TEAM_PAGES.map((team) => ({ team, ...executiveCommunityService(team.name) })).map(
    ({ team, service, code }) => {
      const lists = communityHubLists(input.admissions, team, input.referrals);
      const membership = communityMembershipResolution(input.admissions, team, input.referrals);
      const c = (suffix: string, value: number) => release.count(`team:${team.id}:${suffix}`, value);
      const figures = communityFigures(lists, membership);
      const baseFigure = (suffix: string, value: (typeof figures)["admitted"]) => {
        if (value.kind === "measured") return { kind: "measured" as const, count: c(suffix, value.value) };
        if (value.kind === "unlinkable" && value.words === "not linked to this team")
          return { kind: "unlinkable" as const, words: "not linked to this team" as const };
        throw new Error("Unsupported community reporting availability.");
      };
      const figure = (suffix: string, value: number) =>
        membership.state === "not-computable"
          ? { kind: "unlinkable" as const, words: "not linked to this team" as const }
          : { kind: "measured" as const, count: c(suffix, value) };
      const admitted = baseFigure("admitted", figures.admitted);
      const expected = baseFigure("expected", figures.expected);
      const noDate = figure("noDate", lists.currentlyAdmitted.length - lists.expectedBack.length);
      const due = lists.expectedBack.filter(
        (row) =>
          row.expectedDischargeAt !== null &&
          row.expectedDischargeAt >= input.now &&
          row.expectedDischargeAt < input.now + 7 * MINUTES_PER_DAY,
      ).length;
      const dueOutWeek = figure("dueOutWeek", due);
      const pastDate = figure(
        "pastDate",
        lists.expectedBack.filter(
          (row) => row.expectedDischargeAt !== null && isPastDate(row.expectedDischargeAt, input.now),
        ).length,
      );
      const discharged = baseFigure("discharged", figures.discharged);
      const other = baseFigure("other", figures.other);
      const followUpNotArranged = figure(
        "followUpNotArranged",
        lists.dischargedIntoTheArea.filter((row) => row.followUp?.state !== "arranged").length,
      );
      const followUpArranged = figure(
        "followUpArranged",
        lists.dischargedIntoTheArea.filter((row) => row.followUp?.state === "arranged").length,
      );
      if (admitted.kind === "measured" && expected.kind === "measured" && noDate.kind === "measured") {
        release.partition(admitted.count, [expected.count, noDate.count]);
        if (dueOutWeek.kind === "measured") release.subset(expected.count, dueOutWeek.count);
        if (pastDate.kind === "measured") release.subset(expected.count, pastDate.count);
      }
      if (
        discharged.kind === "measured" &&
        followUpNotArranged.kind === "measured" &&
        followUpArranged.kind === "measured"
      )
        release.partition(discharged.count, [followUpNotArranged.count, followUpArranged.count]);
      return {
        id: team.id,
        name: team.name,
        service,
        code,
        membership: membership.state,
        unresolvable: c("unresolvable", membership.state === "not-computable" ? membership.unresolvable : 0),
        figures: { admitted, expected, discharged, other },
        noDischargeDate: noDate,
        dueOutWeek,
        pastDate,
        followUpNotArranged,
        followUpArranged,
        privateCounts: {
          admitted: membership.state === "not-computable" ? 0 : lists.currentlyAdmitted.length,
          expected: membership.state === "not-computable" ? 0 : lists.expectedBack.length,
          dueOutWeek: membership.state === "not-computable" ? 0 : due,
        },
      };
    },
  );
}

function sumBeds(wards: readonly PublicWard[]): ExecutiveBedCounts {
  const beds: ExecutiveBedCounts = {
    total: 0,
    ready: 0,
    pulled: 0,
    closed: 0,
    occupied: 0,
    inUse: 0,
    beingMadeReady: 0,
    onLeave: 0,
  };
  for (const ward of wards)
    for (const key of Object.keys(beds) as (keyof ExecutiveBedCounts)[]) beds[key] += ward.beds[key];
  return beds;
}

export function executiveServices(
  input: ExecutivePrivateInput,
  places: PlaceLookup,
  catalogueUnits: readonly Pick<Unit, "id" | "siteCode">[],
  wards: readonly PublicWard[],
  eds: readonly ReturnType<typeof executiveEdSummary>[],
  release: ExecutiveCountRelease,
) {
  return HEALTH_SERVICES.map((service) => {
    const ownWards = wards.filter((ward) => ward.service === service);
    const ownUnits = input.units.filter((unit) => ownWards.some((ward) => ward.id === unit.id));
    const ownEds = eds.filter((ed) => ed.service === service);
    const ownReferrals = input.referrals.filter((referral) => siteByCode(referral.originSiteCode)?.service === service);
    const c = (suffix: string, value: number) => release.count(`service:${service}:${suffix}`, value);
    const acceptedAt = (referral: (typeof ownReferrals)[number]) => {
      const acceptance = referral.destinations.find(
        (arm) => arm.destination.kind === "psychiatric_ward" && arm.acceptedUnitId !== undefined,
      );
      if (!acceptance) return null;
      const unit = catalogueUnits.find((entry) => entry.id === acceptance.acceptedUnitId);
      return unit ? (places.unitService(unit.id) ?? null) : undefined;
    };
    const placedWithinService = c("within", ownReferrals.filter((referral) => acceptedAt(referral) === service).length);
    const elsewhere = HEALTH_SERVICES.filter((candidate) => candidate !== service).map((candidate) => ({
      service: candidate,
      count: c(`elsewhere:${candidate}`, ownReferrals.filter((referral) => acceptedAt(referral) === candidate).length),
    }));
    const placedElsewhere = c(
      "elsewhere",
      ownReferrals.filter((referral) => {
        const destination = acceptedAt(referral);
        return destination !== null && destination !== undefined && destination !== service;
      }).length,
    );
    const notYetAcceptedAtWard = c(
      "notAccepted",
      ownReferrals.filter((referral) => acceptedAt(referral) === null).length,
    );
    const indexNotYetAcceptedAtWard = c(
      "indexNotAccepted",
      ownReferrals.filter(
        (referral) =>
          acceptedAt(referral) === null &&
          referral.destinations.some((arm) => arm.destination.kind === "psychiatric_ward"),
      ).length,
    );
    const placedAtUnresolvedWard = c(
      "unresolvedWard",
      ownReferrals.filter((referral) => acceptedAt(referral) === undefined).length,
    );
    const raised = c("referrals", ownReferrals.length);
    release.partition(raised, [placedWithinService, placedElsewhere, notYetAcceptedAtWard, placedAtUnresolvedWard]);
    release.subset(notYetAcceptedAtWard, indexNotYetAcceptedAtWard);
    release.partition(
      placedElsewhere,
      elsewhere.map((entry) => entry.count),
    );
    // The same service matrix cells appear on index and detail.
    for (const entry of elsewhere)
      release.partition(entry.count, [
        release.count(
          `matrix:${service}:${entry.service}`,
          ownReferrals.filter((referral) => acceptedAt(referral) === entry.service).length,
        ),
      ]);
    release.partition(placedWithinService, [
      release.count(
        `matrix:${service}:${service}`,
        ownReferrals.filter((referral) => acceptedAt(referral) === service).length,
      ),
    ]);
    const far = outOfAreaLedger([...input.admissions], ownUnits, input.now);
    const farTotal = c("farFromHome", far.entries.length);
    const bands = OUT_OF_AREA_BANDS.map((band) => ({
      label: TRAVEL_BAND_LABELS[band],
      count: c(`far:${band}`, far.entries.filter((entry) => entry.band === band).length),
    }));
    release.partition(
      farTotal,
      bands.map((band) => band.count),
    );
    const waiting = c(
      "waiting",
      ownEds.reduce((sum, ed) => sum + edJourneyWaitFigures(input.movements, ed.id, input.now).onTheList, 0),
    );
    const over24h = c(
      "over24h",
      ownEds.reduce((sum, ed) => sum + edJourneyWaitFigures(input.movements, ed.id, input.now).over24h, 0),
    );
    release.partition(
      waiting,
      ownEds.map((ed) => ed.onTheList),
    );
    release.partition(
      over24h,
      ownEds.map((ed) => ed.over24h),
    );
    return {
      service,
      beds: sumBeds(ownWards),
      wards: ownWards.length,
      departments: ownEds.length,
      zeroReadyWards: ownWards.filter((ward) => ward.beds.ready === 0).length,
      wardsOverOccupancyLine: ownWards.filter(
        (ward) =>
          ward.beds.total > 0 && Math.round((ward.beds.inUse / ward.beds.total) * 100) >= BED_ALERT_THRESHOLD_PERCENT,
      ).length,
      openNow: ownUnits.reduce((sum, unit) => sum + openBedsNow(unit, input.bedReleases), 0),
      waiting,
      over24h,
      indexNotYetAcceptedAtWard,
      referrals: {
        raised,
        placedWithinService,
        placedElsewhere,
        notYetAcceptedAtWard,
        placedAtUnresolvedWard,
        placedElsewhereByService: elsewhere,
      },
      farFromHome: {
        total: farTotal,
        notBanded: c("far:unrecorded", far.notBanded),
        bands,
        bedDays: far.entries.reduce((sum, entry) => sum + Math.max(0, entry.sinceArrival), 0) / MINUTES_PER_DAY,
      },
    };
  });
}

export function executiveSites(
  input: ExecutivePrivateInput,
  wards: readonly PublicWard[],
  eds: readonly ReturnType<typeof executiveEdSummary>[],
  release: ExecutiveCountRelease,
) {
  const codes = [...new Set([...wards.map((ward) => ward.siteCode), ...eds.map((ed) => ed.siteCode)])];
  return codes.map((code) => {
    const site = siteByCode(code);
    if (!site) throw new Error("Unknown executive site metadata.");
    const siteWards = wards.filter((ward) => ward.siteCode === code);
    const onSite = input.admissions.filter((row) => siteWards.some((ward) => ward.id === row.unitId));
    const pooled = onSite.map((row) => ({ ...row, unitId: "pooled" }));
    const stats = wardStatistics("pooled", pooled, input.now);
    const ed = eds.find((entry) => entry.siteCode === code);
    const c = (suffix: string, value: number) => release.count(`site:${code}:${suffix}`, value);
    const dischargedToday = c(
      "dischargedToday",
      onSite.filter((row) => row.leftAt !== null && dayOf(row.leftAt) === dayOf(input.now)).length,
    );
    const dueToday = c(
      "dueToday",
      onSite.filter(
        (row) =>
          row.state !== "departed" &&
          row.state !== "pulled" &&
          row.expectedDischargeAt !== null &&
          Number.isFinite(row.expectedDischargeAt) &&
          row.expectedDischargeAt >= input.now &&
          dayOf(row.expectedDischargeAt) === dayOf(input.now),
      ).length,
    );
    const blocked = c("blocked", blockedDischargesByReason(onSite).totalCount);
    const zero = (suffix: string) => c(suffix, 0);
    return {
      code,
      name: site.name,
      service: site.service,
      wardIds: siteWards.map((ward) => ward.id),
      edId: ed?.id ?? null,
      beds: sumBeds(siteWards),
      wardsOverLine: siteWards.filter(
        (ward) =>
          ward.beds.total > 0 && Math.round((ward.beds.inUse / ward.beds.total) * 100) >= BED_ALERT_THRESHOLD_PERCENT,
      ).length,
      edWaiting: ed?.onTheList ?? zero("edWaiting"),
      edOver24: ed?.over24h ?? zero("edOver24"),
      edOver48: ed?.over48h ?? zero("edOver48"),
      edLongest: ed?.longestWaitMinutes ?? null,
      dischargedToday,
      dueToday,
      blocked,
      longStays: c("longStays", stats.longStays),
      meanStay: stats.averageLengthOfStayDays,
    };
  });
}

export function executiveJourney(
  input: ExecutivePrivateInput,
  beds: ExecutiveBedCounts,
  release: ExecutiveCountRelease,
  openTotal: ReportingCount,
  endedToday: ReportingCount,
) {
  const open = input.movements.filter(isOpen);
  const c = (suffix: string, value: number) => release.count(`journey:${suffix}`, value);
  const countFigure = (count: ReportingCount) => ({ kind: "count" as const, count });
  const breakdown = (label: string, count: ReportingCount) => ({ label, figure: countFigure(count) });
  const transit = ["pulled", "handover_ready", "moving"] as const;
  const groups = [
    {
      id: "waiting" as const,
      label: "No ward has answered yet",
      caption: "A bed has been asked for",
      rows: open.filter((row) => row.stage === "placement_requested"),
    },
    {
      id: "referred" as const,
      label: "Referred",
      caption: "A ward is weighing it up",
      rows: open.filter((row) => row.stage === "destination_review"),
    },
    {
      id: "accepted" as const,
      label: "Accepted",
      caption: "No bed pulled yet",
      rows: open.filter((row) => row.stage === "accepted_awaiting_bed"),
    },
    {
      id: "moving" as const,
      label: "Pulled or in transit",
      caption: "Bed given, not arrived",
      rows: open.filter((row) => transit.some((stage) => stage === row.stage)),
    },
  ];
  const upstream = groups.map((group) => {
    const total = c(group.id, group.rows.length);
    let rows;
    if (group.id === "moving") {
      rows = transit.map((stage) =>
        breakdown(
          stage === "handover_ready" ? stageCopy[stage].label : stageCopy[stage].shortLabel,
          c(`moving:${stage}`, group.rows.filter((row) => row.stage === stage).length),
        ),
      );
      release.partition(
        total,
        rows.map((row) => row.figure.count),
      );
    } else {
      const past = c(
        `${group.id}:pastDay`,
        group.rows.filter((row) => input.now - row.openedAt >= LONG_WAIT_MINUTES).length,
      );
      const urgent = c(`${group.id}:urgent`, group.rows.filter((row) => row.flaggedUrgent).length);
      release.subset(total, past);
      release.subset(total, urgent);
      rows = [breakdown(`Past ${LONG_WAIT_MINUTES / 60}h`, past), breakdown("Urgent", urgent)];
      const distinct =
        group.id === "waiting"
          ? new Set(group.rows.map((row) => row.originEdId)).size
          : group.id === "accepted"
            ? new Set(group.rows.map((row) => row.acceptedUnitId)).size
            : group.rows.filter((row) => row.declines.length > 0).length;
      const extra = c(`${group.id}:extra`, distinct);
      release.subset(total, extra);
      rows.push(breakdown(group.id === "waiting" ? "EDs" : group.id === "accepted" ? "Wards" : "Declined", extra));
    }
    return {
      id: group.id,
      label: group.label,
      caption: group.caption,
      tone:
        group.id === "accepted"
          ? ("success" as const)
          : group.id === "moving"
            ? ("info" as const)
            : ("neutral" as const),
      figure: countFigure(total),
      breakdown: rows,
    };
  });
  release.partition(
    openTotal,
    upstream.map((stage) => stage.figure.count),
  );
  const planned = input.admissions.filter(
    (row) =>
      row.state !== "departed" &&
      row.state !== "pulled" &&
      row.expectedDischargeAt !== null &&
      row.expectedDischargeAt >= input.now &&
      dayOf(row.expectedDischargeAt) - dayOf(input.now) < 7,
  );
  const plannedTotal = c("planned", planned.length);
  const plannedToday = c(
    "planned:today",
    planned.filter((row) => dayOf(row.expectedDischargeAt!) === dayOf(input.now)).length,
  );
  const plannedTomorrow = c(
    "planned:tomorrow",
    planned.filter((row) => dayOf(row.expectedDischargeAt!) === dayOf(input.now) + 1).length,
  );
  const heldUp = c("planned:blocked", planned.filter((row) => row.blockReason !== null).length);
  release.subset(plannedTotal, plannedToday);
  release.subset(plannedTotal, plannedTomorrow);
  release.subset(plannedTotal, heldUp);
  const left = input.admissions.filter((row) => row.leftAt !== null && dayOf(row.leftAt) === dayOf(input.now));
  const community = c(
    "left:community",
    left.filter((row) => row.leavingDestination === "discharged-to-the-community").length,
  );
  const transferred = c(
    "left:transferred",
    left.filter((row) => row.leavingDestination?.startsWith("transferred-")).length,
  );
  const other = c(
    "left:other",
    left.length -
      left.filter(
        (row) =>
          row.leavingDestination === "discharged-to-the-community" ||
          row.leavingDestination?.startsWith("transferred-"),
      ).length,
  );
  release.partition(endedToday, [community, transferred, other]);
  return [
    ...upstream,
    {
      id: "ward" as const,
      label: "On the ward",
      caption: "In a bed, leave included",
      tone: "success" as const,
      figure: { kind: "bed" as const, value: beds.occupied },
      breakdown: [
        {
          label: "Of beds",
          figure: {
            kind: "text" as const,
            text: `${beds.total ? Math.round((beds.occupied / beds.total) * 100) : 0}%`,
          },
        },
        { label: "On leave", figure: { kind: "bed" as const, value: beds.onLeave } },
        { label: "Ready beds", figure: { kind: "bed" as const, value: beds.ready } },
      ],
    },
    {
      id: "planned" as const,
      label: "Discharge planned",
      caption: "Date in the next 7 days",
      tone: "info" as const,
      figure: countFigure(plannedTotal),
      breakdown: [
        breakdown("Today", plannedToday),
        breakdown("Tomorrow", plannedTomorrow),
        breakdown("Held up", heldUp),
      ],
    },
    {
      id: "discharged" as const,
      label: "Discharged today",
      caption: "Left the ward today",
      tone: "success" as const,
      figure: countFigure(endedToday),
      breakdown: [breakdown("Community", community), breakdown("Transferred", transferred), breakdown("Other", other)],
    },
  ];
}

/** Three-hour phone and four-hour desktop views share hour/measure keys. No event rows leave. */
export function executiveSessionTrends(
  log: readonly EventLogEntry[] | undefined,
  now: number,
  release: ExecutiveCountRelease,
) {
  if (log === undefined) return { state: "unavailable" as const };
  const windows = ([3, 4] as const).map((hourCount) => {
    const source = sessionTrends(log, now, hourCount);
    const rows = source.rows.map((row) => {
      const counts = row.counts.map((value, index) =>
        release.count(`session:${row.id}:hour:${source.hours[index]}`, value),
      );
      const total = release.count(`session:${row.id}:window:${hourCount}`, row.total);
      release.partition(total, counts);
      return { id: row.id, label: row.label, counts, total };
    });
    const counted = release.count(`session:window:${hourCount}`, source.counted);
    release.partition(
      counted,
      rows.map((row) => row.total),
    );
    return { hourCount, hours: source.hours, rows, counted };
  });
  const phone = windows[0]!;
  const desktop = windows[1]!;
  release.subset(desktop.counted, phone.counted);
  for (const row of phone.rows) release.subset(desktop.rows.find((entry) => entry.id === row.id)!.total, row.total);
  return { state: "available" as const, windows };
}
