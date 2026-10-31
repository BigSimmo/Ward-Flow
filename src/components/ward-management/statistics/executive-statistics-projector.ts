import { scopeWardFlowState } from "../ward-access-state";
import { bedStates } from "../ward-bed-states";
import { CLINICAL_VALUES } from "../ward-clinical-values";
import { dayOf, type Instant } from "../ward-clock";
import type { WardFlowState } from "../ward-flow-reducer";
import { wardBedsInUse } from "../ward-occupancy";
import { accessIsValid, edInScope, unitInScope, type PlaceLookup, type WardAccess } from "../ward-role-access";
import { allEmergencyDepartments, siteDirectory } from "../ward-sites";
import { smallNumberParts, smallNumberText } from "../ward-access-scope";
import { waitingInEds, openEdJourneys } from "../ward-shared-figures";
import {
  admissionStagePosition,
  refusedAndNothingPending,
  type AdmissionStagePosition,
  pullToArrival,
  referralToBedJoin,
  declinesByReason,
  blockedDischargesByReason,
} from "./statistics-derivations";
import {
  isExecutiveNetworkAggregate,
  isExecutiveReportingFoundation,
  type ExecutiveBedCounts,
  type ExecutiveNetworkAggregate,
  type ReleasedCount,
  type ExecutiveReportingFoundation,
} from "./executive-statistics-contract";
import {
  executiveEdSummary,
  executiveWardSummary,
  executiveWeeklySummaries,
  executiveJourney,
  executiveSites,
  executiveServices,
  executiveTeams,
  median,
  type ExecutivePrivateInput,
} from "./executive-statistics-derivations";
import { ExecutiveCountRelease } from "./executive-statistics-release";
import { isOpen, unitCapacity } from "../ward-derivations";
import { HEALTH_SERVICES } from "../ward-model";
import { siteByCode } from "../ward-sites";
import { wardStatistics } from "../ward-statistics";
import { bedIsOccupied } from "../ward-admissions";
import { admissionsWithNoCommunityTeam } from "../community/community-derivations";
import { edJourneyWaitFigures, edWaitFigures, ED_WAIT_BANDS } from "./statistics-ed-waits";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES, LONG_WAIT_MINUTES } from "../ward-operational-defaults";
import { isAwaitingAnswer } from "../ward-referrals";
import { bedsPendingPreparation, openBedsNow } from "../ward-bed-availability";
import { bedsBeingPrepared } from "./statistics-derivations";
import { executiveSessionTrends } from "./executive-statistics-derivations";
import type { EventLogEntry } from "../ward-event-log";

export type ExecutiveProjectionOptions = {
  now: Instant;
  dayZero: string;
  startedAt: string;
  /** Trusted place lookup for this world's registry, never supplied by an API caller. */
  places: PlaceLookup;
  /** Current authorised browser session only. Absence is unavailable, never a fake empty history. */
  sessionEvents?: readonly EventLogEntry[];
};

function released(value: number | string): ReleasedCount {
  if (typeof value === "number") return { kind: "exact", value };
  return value === "not shown" ? { kind: "withheld" } : { kind: "small" };
}

function releaseCount(value: number): ReleasedCount {
  const shown = smallNumberText(value);
  return released(shown === String(value) ? value : shown);
}

const smallPositive = (value: number) => value > 0 && value < CLINICAL_VALUES.smallNumberHidden.value;
function releaseFamily(values: readonly number[], protectedFamily: boolean): ReleasedCount[] {
  const protect = protectedFamily || values.some(smallPositive);
  return values.map((value) => (protect && value > 0 ? { kind: "withheld" } : releaseCount(value)));
}

/**
 * Pure Network foundation only: not an operational world or a replacement for every Statistics
 * route. Authorisation precedes this call. Existing executive population rules run privately;
 * only allowlisted aggregates leave it. No runtime caller adopts this new payload yet.
 */
export function projectExecutiveNetworkStatistics(
  state: WardFlowState,
  access: WardAccess,
  options: ExecutiveProjectionOptions,
): ExecutiveNetworkAggregate {
  if (
    !accessIsValid(access) ||
    access.role !== "executive" ||
    (access.scope.kind !== "statewide" && access.scope.kind !== "service")
  ) {
    throw new Error("Executive Network projection requires an executive reporting scope.");
  }
  const { now, places } = options;
  const scoped = scopeWardFlowState(state, access, { now, places }).state;
  // The operational scope shares place metadata globally. Reporting totals must explicitly use
  // this executive's wards, rather than counting global beds beside service-scoped admissions.
  const units = scoped.units.filter((unit) => unitInScope(access.scope, unit.id, places));
  const wards = units.map((unit) => {
    const states = bedStates(unit, scoped.admissions, scoped.bedReleases, scoped.leaveBeds);
    return {
      id: unit.id,
      name: unit.name,
      siteCode: unit.siteCode,
      service: places.unitService(unit.id),
      beds: {
        total: unit.beds,
        ready: states.ready,
        pulled: states.pulled,
        closed: states.closed,
        occupied: states.occupied,
        inUse: wardBedsInUse(unit, scoped.admissions, scoped.bedReleases),
        beingMadeReady: states.beingMadeReady,
        onLeave: states.onLeave,
      },
    };
  });
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
  const stages: Record<AdmissionStagePosition, number> = {
    "no-bed-yet": 0,
    "bed-given-not-arrived": 0,
    "in-the-bed": 0,
    ended: 0,
  };
  for (const admission of scoped.admissions) stages[admissionStagePosition(admission)] += 1;
  const positions = Object.keys(stages) as AdmissionStagePosition[];
  const parts = smallNumberParts(positions.map((position) => stages[position]));
  const admissionStages = Object.fromEntries(positions.map((position, index) => [position, released(parts[index]!)]));
  const recorded = scoped.admissions.length;
  const arrivedToday = scoped.admissions.filter(
    (admission) => admission.arrivedAt !== null && dayOf(admission.arrivedAt) === dayOf(now),
  ).length;
  const endedToday = scoped.admissions.filter(
    (admission) => admission.leftAt !== null && dayOf(admission.leftAt) === dayOf(now),
  ).length;
  // Protect both named small cells and small unshown complements. No residual or raw figure is
  // serialized; every related positive total/subset is withheld together, retaining true zeroes.
  const admissionFigures = releaseFamily(
    [recorded, arrivedToday, endedToday],
    parts.some((part) => typeof part !== "number") ||
      [
        recorded - arrivedToday,
        recorded - endedToday,
        stages["in-the-bed"] + stages.ended - arrivedToday,
        stages.ended - endedToday,
      ].some(smallPositive),
  );
  // Scope determines membership, not the inputs for private statistics. Its count-only rows omit
  // escalation, so use original rows for exactly those scoped IDs; never return the rows or IDs.
  const movementIds = new Set(scoped.movements.map((movement) => movement.id));
  const movements = state.movements.filter((movement) => movementIds.has(movement.id));
  const refused = refusedAndNothingPending(movements, units, now);
  const waiting = waitingInEds(movements, now).total;
  const movementFigures = releaseFamily(
    [waiting, refused.openMovementCount, refused.count, refused.escalatedCount],
    [refused.openMovementCount - waiting, refused.openMovementCount - refused.count - refused.escalatedCount].some(
      smallPositive,
    ),
  );
  const aggregate = {
    kind: "executive-statistics",
    version: 1,
    coverage: "network-foundation",
    threshold: CLINICAL_VALUES.smallNumberHidden.value,
    scope:
      access.scope.kind === "statewide" ? { kind: "statewide" } : { kind: "service", service: access.scope.service },
    asAt: { now, dayZero: options.dayZero, startedAt: options.startedAt },
    wards,
    beds,
    people: {
      waitingInEd: movementFigures[0]!,
      stillOpen: movementFigures[1]!,
      admissionsArrivedToday: admissionFigures[1]!,
      admissionsEndedToday: admissionFigures[2]!,
      admissionsRecorded: admissionFigures[0]!,
      refused: movementFigures[2]!,
      escalated: movementFigures[3]!,
    },
    admissionStages,
  };
  // Refuse incomplete registry/invalid measure inputs, never fabricate a place or a zero.
  if (!isExecutiveNetworkAggregate(aggregate)) throw new Error("Invalid executive Network aggregate.");
  return aggregate;
}

/** Private aggregate bundle. No server/client adopts this until every report consumer is ready. */
export function projectExecutiveReportingFoundation(
  state: WardFlowState,
  access: WardAccess,
  options: ExecutiveProjectionOptions,
): ExecutiveReportingFoundation {
  if (
    !accessIsValid(access) ||
    access.role !== "executive" ||
    (access.scope.kind !== "statewide" && access.scope.kind !== "service")
  )
    throw new Error("Executive reporting requires an executive reporting scope.");
  const release = new ExecutiveCountRelease();
  const scoped = scopeWardFlowState(state, access, { now: options.now, places: options.places }).state;
  const ids = <T extends { id: string }>(rows: readonly T[]) => new Set(rows.map((row) => row.id));
  const member = <T extends { id: string }>(all: readonly T[], rows: readonly T[]) => {
    const selected = ids(rows);
    return all.filter((row) => selected.has(row.id));
  };
  // Scope alone decides membership; complete originals remain private selector inputs.
  const units = state.units.filter((unit) => unitInScope(access.scope, unit.id, options.places));
  const unitDirectory = state.units.map((unit) => ({ id: unit.id, siteCode: unit.siteCode }));
  const input: ExecutivePrivateInput = {
    admissions: member(state.admissions, scoped.admissions),
    movements: member(state.movements, scoped.movements),
    referrals: member(state.referrals, scoped.referrals),
    patients: member(state.patients, scoped.patients),
    units,
    bedReleases: member(state.bedReleases, scoped.bedReleases),
    leaveBeds: member(state.leaveBeds, scoped.leaveBeds),
    now: options.now,
    edAccessTargetMinutes: state.configuration.edAccessTargetMinutes,
    pullHoldMinutes: state.configuration.pullHoldMinutes,
    morningRollupConfirmations: state.morningRollupConfirmations,
    morningRollupDeadlineMinutes: state.configuration.morningRollupDeadlineMinutes,
  };
  const publicNetwork = projectExecutiveNetworkStatistics(state, access, options);
  const c = (key: string, value: number, priority?: number) => release.count(key, value, priority);
  const stagePositions = ["no-bed-yet", "bed-given-not-arrived", "in-the-bed", "ended"] as const;
  const admissionStages = Object.fromEntries(
    stagePositions.map((position) => [
      position,
      c(
        `admission-stage:${position}`,
        input.admissions.filter((row) => admissionStagePosition(row) === position).length,
      ),
    ]),
  );
  const recorded = c("admissions:recorded", input.admissions.length, 0);
  release.partition(
    recorded,
    stagePositions.map((position) => admissionStages[position]!),
  );
  const arrivedToday = c(
    "admissions:arrivedToday",
    input.admissions.filter((row) => row.arrivedAt !== null && dayOf(row.arrivedAt) === dayOf(input.now)).length,
  );
  const endedToday = c(
    "admissions:endedToday",
    input.admissions.filter((row) => row.leftAt !== null && dayOf(row.leftAt) === dayOf(input.now)).length,
  );
  release.subset(recorded, arrivedToday);
  release.subset(recorded, endedToday);
  release.subset(admissionStages.ended!, endedToday);
  const refused = refusedAndNothingPending([...input.movements], units, input.now);
  const open = input.movements.filter(isOpen);
  const stillOpen = c("movements:open", open.length, 0);
  const journeyWaiting = c("movements:edJourneys", openEdJourneys(input.movements, input.now).total);
  const refusedCount = c("movements:refused", refused.count);
  const escalated = c("movements:escalated", refused.escalatedCount);
  release.subset(stillOpen, journeyWaiting);
  release.subset(stillOpen, refusedCount);
  release.subset(stillOpen, escalated);
  const network = {
    ...publicNetwork,
    people: {
      waitingInEd: journeyWaiting,
      stillOpen,
      admissionsArrivedToday: arrivedToday,
      admissionsEndedToday: endedToday,
      admissionsRecorded: recorded,
      refused: refusedCount,
      escalated,
    },
    admissionStages,
  };
  const wards = publicNetwork.wards.map((ward) => executiveWardSummary(ward, input, release));
  const currentAdmissions = c("admissions:current", input.admissions.filter((row) => row.state !== "departed").length);
  release.partition(
    currentAdmissions,
    wards.map((ward) => ward.current),
  );
  release.partition(
    currentAdmissions,
    stagePositions.filter((position) => position !== "ended").map((position) => admissionStages[position]!),
  );
  // Public origin groups summarise only already-authorised records, including inbound
  // journeys. Their presence does not grant a foreign ED detail route.
  const eds = allEmergencyDepartments();
  const openableEmergencyDepartmentIds = eds
    .filter((ed) => edInScope(access.scope, ed.id, options.places))
    .map((ed) => ed.id);
  const emergencyDepartments = eds.map((ed) => {
    const service = options.places.edService(ed.id);
    if (!service) throw new Error("Unknown executive reporting ED service.");
    return executiveEdSummary({ id: ed.id, name: ed.name, siteCode: ed.siteCode, service }, input, release);
  });
  const listedEdJourneys = c(
    "movements:listedEdJourneys",
    eds.reduce((sum, ed) => sum + edJourneyWaitFigures(input.movements, ed.id, input.now).onTheList, 0),
  );
  release.partition(
    listedEdJourneys,
    emergencyDepartments.map((ed) => ed.onTheList),
  );
  release.partition(journeyWaiting, [listedEdJourneys]);
  const physicalWaiting = c("movements:physicalWaiting", waitingInEds(input.movements, input.now).total);
  const listedPhysicalWaiting = c(
    "movements:listedPhysicalWaiting",
    eds.reduce((sum, ed) => sum + edWaitFigures(input.movements, ed.id, input.now).onTheList, 0),
  );
  release.partition(
    listedPhysicalWaiting,
    emergencyDepartments.map((ed) => ed.physicalWaiting),
  );
  release.partition(physicalWaiting, [listedPhysicalWaiting]);
  release.subset(journeyWaiting, physicalWaiting);
  const urgentOpen = c("movements:urgent", open.filter((row) => row.flaggedUrgent).length);
  const unplacedOpen = c("movements:unplaced", open.filter((row) => row.acceptedUnitId === undefined).length);
  release.subset(stillOpen, urgentOpen);
  release.subset(stillOpen, unplacedOpen);
  const journey = executiveJourney(input, publicNetwork.beds, release, stillOpen, endedToday);
  const sites = executiveSites(input, publicNetwork.wards, emergencyDepartments, release);
  for (const site of sites) {
    const ownWards = wards.filter((ward) => ward.siteCode === site.code);
    release.partition(
      site.dischargedToday,
      ownWards.map((ward) => ward.dischargedToday),
    );
    release.partition(
      site.dueToday,
      ownWards.map((ward) => ward.dueToday),
    );
  }
  const services = executiveServices(
    input,
    options.places,
    unitDirectory,
    publicNetwork.wards,
    emergencyDepartments,
    release,
  );
  const openableServiceIds = HEALTH_SERVICES.filter(
    (service) =>
      access.scope.kind === "statewide" || (access.scope.kind === "service" && service === access.scope.service),
  );
  const teams = executiveTeams(input, release);
  const openableCommunityTeamIds = teams
    .filter(
      (team) =>
        access.scope.kind === "statewide" ||
        (access.scope.kind === "service" && options.places.teamService?.(team.id) === access.scope.service),
    )
    .map((team) => team.id);
  // Cross-page ward sums use the same tokens, not independently releasable copies.
  const blockedTotal = c(
    "admissions:blocked",
    wards.reduce((sum, ward) => sum + wardStatistics(ward.id, [...input.admissions], input.now).readyToLeaveCannot, 0),
  );
  release.partition(
    blockedTotal,
    wards.map((ward) => ward.statistics.readyToLeaveCannot),
  );
  const longStayTotal = c(
    "admissions:longStays",
    units.reduce((sum, unit) => sum + wardStatistics(unit.id, [...input.admissions], input.now).longStays, 0),
  );
  release.partition(
    longStayTotal,
    wards.map((ward) => ward.statistics.longStays),
  );
  release.subset(currentAdmissions, blockedTotal);
  release.subset(currentAdmissions, longStayTotal);
  const arrivalsRaw = pullToArrival([...input.admissions]);
  const measuredCount = c("arrivals:measured", arrivalsRaw.measuredCount);
  const arrivalEnded = c("arrivals:ended", arrivalsRaw.endedCount);
  release.subset(measuredCount, arrivalEnded);
  release.subset(recorded, measuredCount);
  const awaitingArrivalCount = c("arrivals:awaiting", arrivalsRaw.awaitingArrivalCount);
  const incoherentCount = c("arrivals:incoherent", arrivalsRaw.incoherentCount);
  release.subset(recorded, awaitingArrivalCount);
  release.subset(recorded, incoherentCount);
  const gaps = input.admissions
    .filter((row) => row.pulledAt !== null && row.arrivedAt !== null)
    .map((row) => row.arrivedAt! - row.pulledAt!)
    .filter((gap) => Number.isFinite(gap) && gap >= 0);
  const hold = input.pullHoldMinutes;
  const hours = (minutes: number) => `${Math.round(minutes / 60)}h`;
  const bandDefinitions = [
    { id: "half-hold", label: `Under ${hours(hold / 2)}`, from: 0, to: hold / 2 },
    { id: "hold", label: `${hours(hold / 2)} to ${hours(hold)}`, from: hold / 2, to: hold },
    { id: "twice-hold", label: `${hours(hold)} to ${hours(hold * 2)}`, from: hold, to: hold * 2 },
    { id: "longer", label: `Over ${hours(hold * 2)}`, from: hold * 2, to: Infinity },
  ];
  const arrivalBands = bandDefinitions.map((band) => ({
    id: band.id,
    label: band.label,
    count: c(`arrivals:band:${band.id}`, gaps.filter((gap) => gap >= band.from && gap < band.to).length),
  }));
  release.partition(
    measuredCount,
    arrivalBands.map((band) => band.count),
  );
  const bedReferrals = input.referrals.filter(
    (referral) =>
      dayOf(referral.raisedAt) === dayOf(input.now) &&
      referral.destinations.some((arm) => arm.destination.kind === "psychiatric_ward"),
  );
  const todayBedReferrals = {
    raised: c("referrals:today:raised", bedReferrals.length),
    accepted: c(
      "referrals:today:accepted",
      bedReferrals.filter((referral) =>
        referral.destinations.some((arm) => arm.destination.kind === "psychiatric_ward" && arm.state === "accepted"),
      ).length,
    ),
    declined: c(
      "referrals:today:declined",
      bedReferrals.filter((referral) =>
        referral.destinations
          .filter((arm) => arm.destination.kind === "psychiatric_ward")
          .every((arm) => arm.state === "declined" && Boolean(arm.declineReason)),
      ).length,
    ),
    open: c(
      "referrals:today:open",
      bedReferrals.filter((referral) =>
        referral.destinations.some((arm) => arm.destination.kind === "psychiatric_ward" && isAwaitingAnswer(arm)),
      ).length,
    ),
  };
  // Accepted and still-open can overlap across parallel destination arms; they are subsets,
  // never a partition. A multi-destination referral is counted once within each actual measure.
  release.subset(todayBedReferrals.raised, todayBedReferrals.accepted);
  release.subset(todayBedReferrals.raised, todayBedReferrals.declined);
  release.subset(todayBedReferrals.raised, todayBedReferrals.open);
  const join = referralToBedJoin([...input.admissions], [...input.referrals]);
  const withReferralIdCount = c("joins:withReferralId", join.withReferralIdCount);
  const joinedCount = c("joins:joined", join.joinedCount);
  const chronologicallyCoherentCount = c("joins:coherent", join.chronologicallyCoherentCount);
  const referralsSearchedCount = c("referrals:searched", join.referralsSearchedCount);
  release.subset(recorded, withReferralIdCount);
  release.subset(withReferralIdCount, joinedCount);
  release.subset(joinedCount, chronologicallyCoherentCount);
  release.subset(referralsSearchedCount, todayBedReferrals.raised);
  release.subset(
    referralsSearchedCount,
    release.sum(
      "services:classifiedReferralOrigins",
      services.map((service) => service.referrals.raised),
    ),
  );
  for (const service of services) {
    const current = release.sum(
      `service:${service.service}:currentAdmissions`,
      wards.filter((ward) => ward.service === service.service).map((ward) => ward.current),
    );
    release.subset(
      current,
      release.sum(`service:${service.service}:farOrUnbanded`, [
        service.farFromHome.total,
        service.farFromHome.notBanded,
      ]),
    );
  }
  const declinesRaw = declinesByReason([...input.movements]);
  const declineTotal = c("declines:total", declinesRaw.totalCount);
  const declineReasons = declinesRaw.tallies.map((entry) => ({
    reason: entry.reason,
    count: c(`declines:reason:${entry.reason}`, entry.count),
  }));
  release.subset(
    declineTotal,
    release.sum(
      "declines:classified",
      declineReasons.map((entry) => entry.count),
    ),
  );
  const blockedRaw = blockedDischargesByReason([...input.admissions]);
  const blockedReasons = blockedRaw.tallies.map((entry) => ({
    reason: entry.reason,
    count: c(`blocked:reason:${entry.reason}`, entry.count),
  }));
  const blockedReasonTotal = c("blocked:total", blockedRaw.totalCount);
  release.partition(blockedReasonTotal, [blockedTotal]);
  release.partition(
    blockedReasonTotal,
    blockedReasons.map((entry) => entry.count),
  );
  const referralMatrix = services.flatMap((from) =>
    HEALTH_SERVICES.map((to) => ({
      from: from.service,
      to,
      count: c(
        `matrix:${from.service}:${to}`,
        input.referrals.filter((row) => {
          if (siteByCode(row.originSiteCode)?.service !== from.service) return false;
          const acceptance = row.destinations.find(
            (arm) => arm.destination.kind === "psychiatric_ward" && arm.acceptedUnitId !== undefined,
          );
          return (
            acceptance !== undefined &&
            unitDirectory.find((unit) => unit.id === acceptance.acceptedUnitId)?.siteCode !== undefined &&
            siteByCode(unitDirectory.find((unit) => unit.id === acceptance.acceptedUnitId)!.siteCode)?.service === to
          );
        }).length,
      ),
    })),
  );
  for (const from of services) {
    const row = referralMatrix.filter((cell) => cell.from === from.service);
    const accepted = c(
      `service:${from.service}:accepted`,
      input.referrals.filter((referral) => {
        if (siteByCode(referral.originSiteCode)?.service !== from.service) return false;
        const acceptance = referral.destinations.find(
          (arm) => arm.destination.kind === "psychiatric_ward" && arm.acceptedUnitId !== undefined,
        );
        return (
          acceptance !== undefined &&
          unitDirectory.some(
            (unit) => unit.id === acceptance.acceptedUnitId && siteByCode(unit.siteCode)?.service !== undefined,
          )
        );
      }).length,
    );
    release.partition(accepted, [from.referrals.placedWithinService, from.referrals.placedElsewhere]);
    release.partition(
      accepted,
      row.map((cell) => cell.count),
    );
  }
  for (const to of HEALTH_SERVICES) {
    const column = referralMatrix.filter((cell) => cell.to === to);
    const values = input.referrals.filter((referral) => {
      const from = siteByCode(referral.originSiteCode)?.service;
      if (!services.some((entry) => entry.service === from)) return false;
      const acceptance = referral.destinations.find(
        (arm) => arm.destination.kind === "psychiatric_ward" && arm.acceptedUnitId !== undefined,
      );
      const unit = acceptance ? unitDirectory.find((entry) => entry.id === acceptance.acceptedUnitId) : undefined;
      return unit && siteByCode(unit.siteCode)?.service === to;
    }).length;
    release.partition(
      c(`matrix:column:${to}`, values),
      column.map((cell) => cell.count),
    );
  }
  const weeks = executiveWeeklySummaries(input, options.dayZero, release);
  const recordedMovements = c("movements:recorded", input.movements.length, 0);
  release.subset(
    recordedMovements,
    release.sum(
      "weeks:raised",
      weeks.map((week) => week.pilot.requests.raised),
    ),
  );
  release.subset(
    recordedMovements,
    release.sum(
      "weeks:arrivals",
      weeks.map((week) => week.pilot.completeness.arrivals),
    ),
  );
  release.subset(
    recordedMovements,
    release.sum(
      "weeks:firstPulls",
      weeks.map((week) => week.pilot.requestToBedHeld.population),
    ),
  );
  for (const step of ["ask", "answer", "hold", "leave", "travel"] as const)
    release.subset(
      recordedMovements,
      release.sum(
        `weeks:step:${step}`,
        weeks.map((week) => week.pilot.steps.find((entry) => entry.id === step)!.summary.population),
      ),
    );
  release.subset(
    declineTotal,
    release.sum(
      "weeks:placementDeclines",
      weeks.map((week) => week.report.declines.placement),
    ),
  );
  release.partition(
    endedToday,
    sites.map((site) => site.dischargedToday),
  );
  release.partition(
    blockedTotal,
    sites.map((site) => site.blocked),
  );
  release.partition(
    longStayTotal,
    sites.map((site) => site.longStays),
  );
  const plannedStage = journey.find((stage) => stage.id === "planned");
  if (plannedStage?.figure.kind === "count")
    release.partition(
      plannedStage.figure.count,
      wards.map((ward) => ward.dueThisWeek),
    );
  const plannedToday = plannedStage?.breakdown.find((entry) => entry.label === "Today");
  if (plannedToday?.figure.kind === "count")
    release.partition(
      plannedToday.figure.count,
      sites.map((site) => site.dueToday),
    );
  const admitted = c(
    "community:admitted",
    teams.reduce((sum, team) => sum + team.privateCounts.admitted, 0),
  );
  const expected = c(
    "community:expected",
    teams.reduce((sum, team) => sum + team.privateCounts.expected, 0),
  );
  const dueOutWeek = c(
    "community:dueOutWeek",
    teams.reduce((sum, team) => sum + team.privateCounts.dueOutWeek, 0),
  );
  release.partition(
    admitted,
    teams.flatMap((team) => (team.figures.admitted.kind === "measured" ? [team.figures.admitted.count] : [])),
  );
  release.partition(
    expected,
    teams.flatMap((team) => (team.figures.expected.kind === "measured" ? [team.figures.expected.count] : [])),
  );
  release.partition(
    dueOutWeek,
    teams.flatMap((team) => (team.dueOutWeek.kind === "measured" ? [team.dueOutWeek.count] : [])),
  );
  const unlinkedRows = admissionsWithNoCommunityTeam(input.admissions, input.referrals);
  const unlinkedAdmissions = c("community:unlinkedAdmissions", unlinkedRows.length);
  const noTeamInBed = c("community:noTeamInBed", unlinkedRows.filter(bedIsOccupied).length);
  release.subset(recorded, unlinkedAdmissions);
  release.subset(unlinkedAdmissions, noTeamInBed);
  const waits = allEmergencyDepartments().flatMap((ed) =>
    edJourneyWaitFigures(input.movements, ed.id, input.now).waitingMovements.map((entry) => entry.waitMinutes),
  );
  const over8h = c("movements:edOver8h", waits.filter((value) => value >= ED_SEVERE_PRESSURE_WAIT_MINUTES).length);
  const over24h = c("movements:edOver24h", waits.filter((value) => value >= LONG_WAIT_MINUTES).length);
  const listedOver24h = c(
    "movements:listedOver24h",
    eds.reduce((sum, ed) => sum + edJourneyWaitFigures(input.movements, ed.id, input.now).over24h, 0),
  );
  release.partition(
    listedOver24h,
    emergencyDepartments.map((ed) => ed.over24h),
  );
  release.partition(over24h, [listedOver24h]);
  const listedOver8h = c(
    "movements:listedOver8h",
    eds.reduce(
      (sum, ed) =>
        sum +
        edJourneyWaitFigures(input.movements, ed.id, input.now).waitingMovements.filter(
          (entry) => entry.waitMinutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES,
        ).length,
      0,
    ),
  );
  release.partition(
    listedOver8h,
    emergencyDepartments.map((ed) => ed.over8h),
  );
  release.partition(over8h, [listedOver8h]);
  release.subset(journeyWaiting, over8h);
  release.subset(over8h, over24h);
  const edIndex = {
    waiting: journeyWaiting,
    unplaced: release.sum(
      "edIndex:unplaced",
      emergencyDepartments.map((ed) => ed.unplaced),
    ),
    urgent: release.sum(
      "edIndex:urgent",
      emergencyDepartments.map((ed) => ed.urgent),
    ),
    over24: over24h,
    over48: release.sum(
      "edIndex:over48",
      emergencyDepartments.map((ed) => ed.over48h),
    ),
    stillInEd: release.sum(
      "edIndex:stillInEd",
      emergencyDepartments.map((ed) => ed.stillInEd),
    ),
    inTransit: release.sum(
      "edIndex:inTransit",
      emergencyDepartments.map((ed) => ed.inTransit),
    ),
    bands: ED_WAIT_BANDS.map((band, index) => ({
      label: band.label,
      count: release.sum(
        `edIndex:band:${band.label}`,
        emergencyDepartments.map((ed) => ed.bands[index]!.count),
      ),
    })),
  };
  release.partition(journeyWaiting, [edIndex.stillInEd, edIndex.inTransit]);
  release.partition(
    journeyWaiting,
    edIndex.bands.map((band) => band.count),
  );
  release.subset(urgentOpen, edIndex.urgent);
  release.subset(unplacedOpen, edIndex.unplaced);
  release.subset(over24h, edIndex.over48);
  release.subset(edIndex.stillInEd, physicalWaiting);
  const pooled = input.admissions
    .filter((row) => units.some((unit) => unit.id === row.unitId))
    .map((row) => ({ ...row, unitId: "pooled" }));
  const dto = release.resolve({
    kind: "executive-reporting",
    version: 1,
    coverage: "private-bundle",
    network,
    sampleScenario: state.scenario,
    publicConfiguration: {
      edAccessTargetMinutes: state.configuration.edAccessTargetMinutes,
      parallelReferralCap: state.configuration.parallelReferralCap,
      pullHoldMinutes: state.configuration.pullHoldMinutes,
      morningRollupDeadlineMinutes: state.configuration.morningRollupDeadlineMinutes,
      dueSoonUrgentMinutes: state.configuration.dueSoonUrgentMinutes,
      dueSoonMinutes: state.configuration.dueSoonMinutes,
      referralDecisionTargetMinutes: state.configuration.referralDecisionTargetMinutes,
      transferAcceptanceTargetMinutes: state.configuration.transferAcceptanceTargetMinutes,
      transportBookedTargetMinutes: state.configuration.transportBookedTargetMinutes,
      forecastShortBeds: state.configuration.forecastShortBeds,
      forecastEdLeadMinutes: state.configuration.forecastEdLeadMinutes,
      forecastWorseBeds: state.configuration.forecastWorseBeds,
    },
    settings: { pullHoldMinutes: input.pullHoldMinutes, parallelReferralCap: state.configuration.parallelReferralCap },
    capacity: {
      ready: units.reduce((sum, unit) => sum + unitCapacity(unit, input.bedReleases).available, 0),
      empty: units.reduce((sum, unit) => sum + unit.empty.value, 0),
      allocatable: units.reduce((sum, unit) => sum + unit.allocatable.value, 0),
      openNow: units.reduce((sum, unit) => sum + openBedsNow(unit, input.bedReleases), 0),
      pendingPreparation: units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, input.bedReleases), 0),
      preparingCount: bedsBeingPrepared(input.bedReleases),
    },
    sessionTrends: executiveSessionTrends(options.sessionEvents, input.now, release),
    catalogue: { sites: siteDirectory.map((site) => ({ code: site.code, name: site.name, service: site.service })) },
    wards,
    emergencyDepartments,
    openableEmergencyDepartmentIds,
    openableCommunityTeamIds,
    openableServiceIds,
    edIndex,
    services,
    sites,
    journey,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      service: team.service,
      code: team.code,
      membership: team.membership,
      unresolvable: team.unresolvable,
      figures: team.figures,
      noDischargeDate: team.noDischargeDate,
      dueOutWeek: team.dueOutWeek,
      pastDate: team.pastDate,
      followUpNotArranged: team.followUpNotArranged,
      followUpArranged: team.followUpArranged,
    })),
    community: {
      admitted,
      expected,
      dueOutWeek,
      noTeamInBed,
      unlinkedAdmissions,
      admissionsRecorded: recorded,
      activeTeams: teams.filter((team) => team.privateCounts.admitted > 0).length,
      emptyTeams: teams.filter((team) => team.figures.admitted.kind === "measured" && team.privateCounts.admitted === 0)
        .length,
      unknownTeams: teams.filter((team) => team.figures.admitted.kind !== "measured").length,
    },
    networkDetails: {
      physicalWaiting,
      listedEdJourneys,
      listedPhysicalWaiting,
      listedOver8h,
      listedOver24h,
      urgentOpen,
      unplacedOpen,
      over8h,
      over24h,
      medianWaitMinutes: median(waits),
      pooledAverageStayDays: wardStatistics("pooled", pooled, input.now).averageLengthOfStayDays,
      blockedTotal,
      longStayTotal,
      todayBedReferrals,
      arrivalBands,
      arrivals: {
        measuredCount,
        averageMinutes: arrivalsRaw.averageMinutes,
        shortestMinutes: arrivalsRaw.shortestMinutes,
        longestMinutes: arrivalsRaw.longestMinutes,
        endedCount: arrivalEnded,
        awaitingArrivalCount,
        incoherentCount,
      },
      referralJoin: { withReferralIdCount, joinedCount, chronologicallyCoherentCount, referralsSearchedCount },
      declines: {
        total: declineTotal,
        movementsWithDeclines: c("declines:movements", declinesRaw.movementsWithDeclinesCount),
        movementsExamined: c("movements:recorded", declinesRaw.movementCount),
        byReason: declineReasons,
      },
      blocked: {
        total: blockedReasonTotal,
        admissionsExamined: c("admissions:current", blockedRaw.admissionCount),
        byReason: blockedReasons,
      },
    },
    referralMatrix,
    weeks,
  });
  if (!isExecutiveReportingFoundation(dto)) throw new Error("Invalid executive reporting bundle.");
  return dto;
}
