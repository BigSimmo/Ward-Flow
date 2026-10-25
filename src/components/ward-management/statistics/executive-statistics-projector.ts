import { scopeWardFlowState } from "../ward-access-state";
import { bedStates } from "../ward-bed-states";
import { CLINICAL_VALUES } from "../ward-clinical-values";
import { dayOf, type Instant } from "../ward-clock";
import type { WardFlowState } from "../ward-flow-reducer";
import { wardBedsInUse } from "../ward-occupancy";
import { accessIsValid, edInScope, unitInScope, type PlaceLookup, type WardAccess } from "../ward-role-access";
import { allEmergencyDepartments, siteDirectory } from "../ward-sites";
import { smallNumberParts, smallNumberText } from "../ward-access-scope";
import { waitingInEds } from "../ward-shared-figures";
import {
  admissionStagePosition,
  refusedAndNothingPending,
  type AdmissionStagePosition,
} from "./statistics-derivations";
import {
  isExecutiveNetworkAggregate,
  isExecutiveReportingFoundation,
  EXECUTIVE_REPORTING_OMITTED_FAMILIES,
  type ExecutiveBedCounts,
  type ExecutiveNetworkAggregate,
  type ReleasedCount,
  type ExecutiveReportingFoundation,
} from "./executive-statistics-contract";
import { executiveEdSummary, executiveWardSummary, executiveWeeklySummaries } from "./executive-statistics-derivations";

export type ExecutiveProjectionOptions = {
  now: Instant;
  dayZero: string;
  startedAt: string;
  /** Trusted place lookup for this world's registry, never supplied by an API caller. */
  places: PlaceLookup;
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

/** Inactive expanded foundation. Its unfinished cross-route release graph deliberately withholds
 * every positive patient/event count. This is not the final approved reporting rule, nor a
 * runtime replacement for the existing screens. Exact permitted bed facts/durations survive. */
export function projectExecutiveReportingFoundation(
  state: WardFlowState,
  access: WardAccess,
  options: ExecutiveProjectionOptions,
): ExecutiveReportingFoundation {
  const measuredNetwork = projectExecutiveNetworkStatistics(state, access, options);
  // Complementary protection spans the whole new foundation, including its Network totals.
  const protect = (figure: ReleasedCount): ReleasedCount =>
    figure.kind === "exact" && figure.value === 0 ? figure : { kind: "withheld" };
  const network = {
    ...measuredNetwork,
    people: Object.fromEntries(Object.entries(measuredNetwork.people).map(([key, figure]) => [key, protect(figure)])),
    admissionStages: Object.fromEntries(
      Object.entries(measuredNetwork.admissionStages).map(([key, figure]) => [key, protect(figure)]),
    ),
  };
  const scoped = scopeWardFlowState(state, access, { now: options.now, places: options.places }).state;
  // Scope is the sole membership authority. Hydrate those exact members privately because its
  // count-only copies intentionally omit historical selector inputs. Never serialize these rows.
  const admissions = new Set(scoped.admissions.map((row) => row.id));
  const movements = new Set(scoped.movements.map((row) => row.id));
  const referrals = new Set(scoped.referrals.map((row) => row.id));
  const patients = new Set(scoped.patients.map((row) => row.id));
  const units = state.units.filter((unit) => unitInScope(access.scope, unit.id, options.places));
  const input = {
    admissions: state.admissions.filter((row) => admissions.has(row.id)),
    movements: state.movements.filter((row) => movements.has(row.id)),
    referrals: state.referrals.filter((row) => referrals.has(row.id)),
    patients: state.patients.filter((row) => patients.has(row.id)),
    units,
    bedReleases: scoped.bedReleases,
    leaveBeds: scoped.leaveBeds,
    now: options.now,
    edAccessTargetMinutes: state.configuration.edAccessTargetMinutes,
  };
  const emergencyDepartments = allEmergencyDepartments()
    .filter((ed) => edInScope(access.scope, ed.id, options.places))
    .map((ed) => {
      const service = options.places.edService(ed.id);
      if (!service) throw new Error("Unknown executive reporting ED service.");
      return executiveEdSummary(
        { id: ed.id, name: ed.name, siteCode: ed.siteCode, service },
        input.movements,
        options.now,
      );
    });
  const dto = {
    kind: "executive-reporting-foundation",
    version: 1,
    coverage: "reporting-foundation",
    omittedFamilies: [...EXECUTIVE_REPORTING_OMITTED_FAMILIES],
    network,
    catalogue: {
      sites: siteDirectory
        .filter(
          (site) =>
            access.scope.kind === "statewide" ||
            (access.scope.kind === "service" && site.service === access.scope.service),
        )
        .map((site) => ({ code: site.code, name: site.name, service: site.service })),
    },
    wards: measuredNetwork.wards.map((ward) => executiveWardSummary(ward, input.admissions, options.now)),
    emergencyDepartments,
    weeks: executiveWeeklySummaries(input, options.dayZero, state.configuration.pullHoldMinutes),
  };
  if (!isExecutiveReportingFoundation(dto)) throw new Error("Invalid executive reporting foundation.");
  return dto;
}
