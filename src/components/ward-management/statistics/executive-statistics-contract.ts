import { z } from "zod";
import { HEALTH_SERVICES, DECLINE_REASONS, SEX_DESIGNATIONS } from "../ward-model";
import { STAY_BANDS } from "../ward-admissions";
import { BED_RELEASE_BLOCKERS, OVERRIDE_REASONS } from "../ward-change-reasons";
import { DECLINE_REASON_LABELS } from "../ward-referrals";
import { COMMUNITY_TEAM_PAGES } from "../community/community-derivations";
import { OUT_OF_AREA_BANDS, TRAVEL_BAND_LABELS } from "../ward-distance";
import { UNKNOWN_DECLINE_REASON_LABEL } from "../reports/weekly-report";
import { allEmergencyDepartments, siteDirectory } from "../ward-sites";
import { WARD_SCENARIOS } from "../ward-scenarios";
import { CLINICAL_VALUES } from "../ward-clinical-values";
import { ED_WAIT_BANDS } from "./statistics-ed-waits";
import { reportWeek } from "../reports/weekly-report";
import { validateConfiguration } from "../ward-configuration";

/** Foundation only. No server or screen adopts this payload until its full reporting contract is ready. */
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const releasedCount = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("exact"),
    value: count.refine((value) => value === 0 || value >= CLINICAL_VALUES.smallNumberHidden.value),
  }),
  z.strictObject({ kind: z.literal("small") }),
  z.strictObject({ kind: z.literal("withheld") }),
]);
const reasonCodes = new Set<string>([...DECLINE_REASONS, ...BED_RELEASE_BLOCKERS]);
const weeklyDeclineLabels = new Set<string>([
  ...DECLINE_REASONS.map((reason) => DECLINE_REASON_LABELS[reason]),
  UNKNOWN_DECLINE_REASON_LABEL,
]);
const weeklyOverrideLabels = new Set<string>([...OVERRIDE_REASONS, UNKNOWN_DECLINE_REASON_LABEL]);

export type ReleasedCount = z.infer<typeof releasedCount>;

const bedCounts = z.strictObject({
  total: count,
  ready: count,
  pulled: count,
  closed: count,
  occupied: count,
  inUse: count,
  beingMadeReady: count,
  onLeave: count,
});

export type ExecutiveBedCounts = z.infer<typeof bedCounts>;

const date = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const publicLabel = z.string().min(1).max(200);
const scope = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("statewide") }),
  z.strictObject({ kind: z.literal("service"), service: z.enum(HEALTH_SERVICES) }),
]);

const networkAggregate = z.strictObject({
  kind: z.literal("executive-statistics"),
  version: z.literal(1),
  coverage: z.literal("network-foundation"),
  threshold: z.literal(CLINICAL_VALUES.smallNumberHidden.value),
  scope,
  asAt: z.strictObject({ now: z.number().finite(), dayZero: date, startedAt: date }),
  wards: z.array(
    z.strictObject({
      id: publicLabel,
      name: publicLabel,
      siteCode: publicLabel,
      service: z.enum(HEALTH_SERVICES),
      beds: bedCounts,
    }),
  ),
  beds: bedCounts,
  people: z.strictObject({
    waitingInEd: releasedCount,
    stillOpen: releasedCount,
    admissionsArrivedToday: releasedCount,
    admissionsEndedToday: releasedCount,
    admissionsRecorded: releasedCount,
    refused: releasedCount,
    escalated: releasedCount,
  }),
  admissionStages: z.strictObject({
    "no-bed-yet": releasedCount,
    "bed-given-not-arrived": releasedCount,
    "in-the-bed": releasedCount,
    ended: releasedCount,
  }),
});

export type ExecutiveNetworkAggregate = z.infer<typeof networkAggregate>;

/** Validate the public reporting object, never a permissive operational-state schema. */
export function isExecutiveNetworkAggregate(value: unknown): value is ExecutiveNetworkAggregate {
  const parsed = networkAggregate.safeParse(value);
  if (!parsed.success) return false;
  const aggregate = parsed.data;
  const ids = new Set(aggregate.wards.map((ward) => ward.id));
  if (ids.size !== aggregate.wards.length) return false;
  if (aggregate.scope.kind === "service") {
    const service = aggregate.scope.service;
    if (aggregate.wards.some((ward) => ward.service !== service)) return false;
  }
  if (
    ![...Object.values(aggregate.people), ...Object.values(aggregate.admissionStages)].every(
      (figure) => figure.kind !== "exact" || figure.value === 0 || figure.value >= aggregate.threshold,
    )
  )
    return false;
  const total = aggregate.people.admissionsRecorded;
  const parts = Object.values(aggregate.admissionStages);
  const safeResiduals = (values: readonly number[]) =>
    values.every((value) => value >= 0 && (value === 0 || value >= aggregate.threshold));
  const zeroOrWithheld = (figure: ReleasedCount) =>
    figure.kind === "withheld" || (figure.kind === "exact" && figure.value === 0);
  const admissionFigures = [total, aggregate.people.admissionsArrivedToday, aggregate.people.admissionsEndedToday];
  if (parts.some((part) => part.kind !== "exact") || admissionFigures.some((figure) => figure.kind !== "exact")) {
    if (!admissionFigures.every(zeroOrWithheld)) return false;
  } else {
    const values = admissionFigures.map((figure) => (figure.kind === "exact" ? figure.value : 0));
    const inBed = aggregate.admissionStages["in-the-bed"];
    const ended = aggregate.admissionStages.ended;
    if (
      !safeResiduals([
        values[0]! - values[1]!,
        values[0]! - values[2]!,
        (inBed.kind === "exact" ? inBed.value : 0) + (ended.kind === "exact" ? ended.value : 0) - values[1]!,
        (ended.kind === "exact" ? ended.value : 0) - values[2]!,
      ])
    )
      return false;
  }
  const movementFigures = [
    aggregate.people.waitingInEd,
    aggregate.people.stillOpen,
    aggregate.people.refused,
    aggregate.people.escalated,
  ];
  if (movementFigures.some((figure) => figure.kind !== "exact")) {
    if (!movementFigures.every(zeroOrWithheld)) return false;
  } else {
    const values = movementFigures.map((figure) => (figure.kind === "exact" ? figure.value : 0));
    if (!safeResiduals([values[1]! - values[0]!, values[1]! - values[2]! - values[3]!])) return false;
  }
  if (total.kind === "exact") {
    const hidden = parts.filter((part) => part.kind !== "exact");
    const gap = total.value - parts.reduce((sum, part) => sum + (part.kind === "exact" ? part.value : 0), 0);
    const minimum = hidden.filter((part) => part.kind === "small").length;
    const maximum = hidden.some((part) => part.kind === "withheld") ? Infinity : minimum * (aggregate.threshold - 1);
    if (gap < minimum || gap > maximum || (hidden.length === 0 && gap !== 0)) return false;
    // A single hidden part, or all small parts pinned at a range endpoint, is still exactly known.
    if (hidden.length === 1 || (hidden.length > 0 && minimum === hidden.length && (gap === minimum || gap === maximum)))
      return false;
  }
  return true;
}

/** All person/event counts pass through the shared bundle release registry. */
const foundationCount = releasedCount;
const duration = z.number().finite().nonnegative().nullable();
const durationSummary = z.strictObject({
  median: duration,
  p90: duration,
  sampleSize: foundationCount,
  population: foundationCount,
});
const wardSummary = z.strictObject({
  id: publicLabel,
  name: publicLabel,
  siteCode: publicLabel,
  service: z.enum(HEALTH_SERVICES),
  beds: bedCounts,
  cohort: publicLabel,
  authorised: z.boolean(),
  lockedBeds: count,
  isClosed: z.boolean(),
  sexDesignation: z.enum(SEX_DESIGNATIONS),
  confirmedAt: z.number().finite(),
  lockedReady: count,
  openReady: count,
  openNow: count,
  capacityReady: count,
  empty: count,
  allocatable: count,
  pendingPreparation: count,
  current: foundationCount,
  blocked: foundationCount,
  awaitingAnswer: foundationCount,
  referrals: z.strictObject({
    askedAndWaiting: foundationCount,
    askedAndWaitingOpen: foundationCount,
    everAccepted: foundationCount,
    everDeclined: foundationCount,
  }),
  bedMapCounts: z.strictObject({
    occupied: count,
    leave: count,
    pulled: count,
    ready: count,
    prep: count,
    closed: count,
  }),
  unplacedBedMapRecords: foundationCount,
  oldestPulledMinutes: duration,
  longestStayDays: duration,
  meanCurrentStayDays: duration,
  stayBands: z.array(z.strictObject({ id: publicLabel, label: publicLabel, count: foundationCount })).max(20),
  unrecordedStay: foundationCount,
  dueByDay: z.array(z.strictObject({ offset: z.number().int().min(0).max(6), count: foundationCount })).length(7),
  dueThisWeek: foundationCount,
  dischargedToday: foundationCount,
  dueToday: foundationCount,
  dischargeDates: z.strictObject({ withDate: foundationCount, withoutDate: foundationCount }),
  readyToLeave: z.strictObject({
    state: z.enum(["measured", "unavailable"]),
    total: foundationCount.nullable(),
    byReason: z.array(z.strictObject({ reason: publicLabel, count: foundationCount })).max(40),
  }),
  statistics: z.strictObject({
    averageLengthOfStayDays: duration,
    averageEmptyBedMinutes: duration,
    emptyBedMinutesShortest: duration,
    emptyBedMinutesLongest: duration,
    averageWaitlistWaitMinutes: duration,
    lengthOfStayIncoherentCount: foundationCount,
    emptyBedIncoherentCount: foundationCount,
    readyToLeaveCannot: foundationCount,
    longStays: foundationCount,
    dischargeDateOutcomes: z.strictObject({
      met: foundationCount,
      missed: foundationCount,
      moved: foundationCount,
      consideredCount: foundationCount,
    }),
  }),
});
const edSummary = z.strictObject({
  id: publicLabel,
  name: publicLabel,
  siteCode: publicLabel,
  service: z.enum(HEALTH_SERVICES),
  onTheList: foundationCount,
  urgent: foundationCount,
  unplaced: foundationCount,
  over24h: foundationCount,
  over48h: foundationCount,
  over8h: foundationCount,
  longestWaitMinutes: duration,
  medianWaitMinutes: duration,
  physicalWaiting: foundationCount,
  physicalLongestWaitMinutes: duration,
  stillInEd: foundationCount,
  inTransit: foundationCount,
  legalClockBreachedCount: foundationCount,
  declines: z.strictObject({
    total: foundationCount,
    noFreeBed: foundationCount,
    notSuitable: foundationCount.nullable(),
    byReason: z.array(z.strictObject({ reason: publicLabel, count: foundationCount })).max(40),
  }),
  bands: z.array(z.strictObject({ label: publicLabel, count: foundationCount })),
});
const reportWeekSchema = z.strictObject({
  offset: z.number().int().min(-1).max(7),
  start: z.number().finite(),
  end: z.number().finite(),
  countedEnd: z.number().finite(),
});
const pairedCounts = z.strictObject({
  placement: foundationCount,
  referral: foundationCount,
  byReason: z.array(z.strictObject({ reason: publicLabel, count: foundationCount })).max(60),
});
const weeklySummary = z.strictObject({
  week: reportWeekSchema,
  report: z.strictObject({
    edWaits: z.strictObject({
      targetMinutes: z.number().finite().nonnegative(),
      count: foundationCount,
      longestMinutes: duration,
    }),
    outOfArea: z.strictObject({ bedDays: z.number().finite().nonnegative(), people: foundationCount }),
    delayedDischarge: z.strictObject({
      bedDays: z.number().finite().nonnegative(),
      people: foundationCount,
      recordedFrom: z.number().finite().nullable(),
      unmeasuredStays: foundationCount,
    }),
    declines: pairedCounts,
    overrides: pairedCounts,
    occupancy: z.strictObject({
      beds: count,
      occupiedBedDays: z.number().finite().nonnegative(),
      averagePercent: duration,
      now: z.strictObject({ beds: count, occupied: count, pulled: count, inUse: count }),
    }),
  }),
  pilot: z.strictObject({
    requestToArrival: durationSummary,
    bedFigures: z.strictObject({
      wards: count,
      confirmedToday: count,
      onTime: count,
      deadlineMinutes: z.number().finite().nonnegative(),
    }),
    requestToBedHeld: durationSummary,
    steps: z.array(
      z.strictObject({ id: z.enum(["ask", "answer", "hold", "leave", "travel"]), summary: durationSummary }),
    ),
    requests: z.strictObject({
      raised: foundationCount,
      noWardAsked: foundationCount,
      duplicates: foundationCount,
      windowMinutes: z.number().finite().nonnegative(),
    }),
    holds: z.strictObject({ held: foundationCount, ranOut: foundationCount, givenBack: foundationCount }),
    transport: z.strictObject({
      collectedToArrived: durationSummary,
      lateCollections: foundationCount,
      collections: foundationCount,
      cancelled: foundationCount,
    }),
    completeness: z.strictObject({ arrivals: foundationCount, complete: foundationCount }),
  }),
});

const reasonCount = z.strictObject({ reason: publicLabel, count: foundationCount });
const countBand = z.strictObject({ label: publicLabel, count: foundationCount });
const availability = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("measured"), count: foundationCount }),
  z.strictObject({ kind: z.literal("unlinkable"), words: z.literal("not linked to this team") }),
]);
const serviceSummary = z.strictObject({
  service: z.enum(HEALTH_SERVICES),
  beds: bedCounts,
  wards: count,
  departments: count,
  zeroReadyWards: count,
  wardsOverOccupancyLine: count,
  openNow: count,
  waiting: foundationCount,
  over24h: foundationCount,
  indexNotYetAcceptedAtWard: foundationCount,
  referrals: z.strictObject({
    raised: foundationCount,
    placedWithinService: foundationCount,
    placedElsewhere: foundationCount,
    notYetAcceptedAtWard: foundationCount,
    placedAtUnresolvedWard: foundationCount,
    placedElsewhereByService: z
      .array(z.strictObject({ service: z.enum(HEALTH_SERVICES), count: foundationCount }))
      .max(HEALTH_SERVICES.length),
  }),
  farFromHome: z.strictObject({
    total: foundationCount,
    notBanded: foundationCount,
    bands: z.array(countBand).max(20),
    bedDays: z.number().finite().nonnegative(),
  }),
});
const teamSummary = z.strictObject({
  id: publicLabel,
  name: publicLabel,
  service: z.enum(HEALTH_SERVICES).nullable(),
  code: publicLabel,
  membership: z.enum(["members", "measured-empty", "not-computable"]),
  unresolvable: foundationCount,
  figures: z.strictObject({
    admitted: availability,
    expected: availability,
    discharged: availability,
    other: availability,
  }),
  noDischargeDate: availability,
  dueOutWeek: availability,
  pastDate: availability,
  followUpNotArranged: availability,
  followUpArranged: availability,
});
const journeyValue = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("count"), count: foundationCount }),
  z.strictObject({ kind: z.literal("bed"), value: count }),
  z.strictObject({ kind: z.literal("text"), text: publicLabel }),
]);
const siteSummary = z.strictObject({
  code: publicLabel,
  name: publicLabel,
  service: z.enum(HEALTH_SERVICES),
  wardIds: z.array(publicLabel),
  edId: publicLabel.nullable(),
  beds: bedCounts,
  wardsOverLine: count,
  edWaiting: foundationCount,
  edOver24: foundationCount,
  edOver48: foundationCount,
  edLongest: duration,
  dischargedToday: foundationCount,
  dueToday: foundationCount,
  blocked: foundationCount,
  longStays: foundationCount,
  meanStay: duration,
});

const publicConfiguration = z
  .strictObject({
    edAccessTargetMinutes: count,
    parallelReferralCap: count,
    pullHoldMinutes: count,
    morningRollupDeadlineMinutes: count,
    dueSoonUrgentMinutes: count,
    dueSoonMinutes: count,
    referralDecisionTargetMinutes: count,
    transferAcceptanceTargetMinutes: count,
    transportBookedTargetMinutes: count,
    forecastShortBeds: count,
    forecastEdLeadMinutes: count,
    forecastWorseBeds: count,
  })
  .refine((value) => validateConfiguration(value) !== null);

const reportingFoundation = z.strictObject({
  kind: z.literal("executive-reporting"),
  version: z.literal(1),
  coverage: z.literal("private-bundle"),
  network: networkAggregate,
  sampleScenario: z.enum(WARD_SCENARIOS),
  publicConfiguration,
  settings: z.strictObject({ pullHoldMinutes: z.number().finite().positive(), parallelReferralCap: count }),
  capacity: z.strictObject({
    ready: count,
    empty: count,
    allocatable: count,
    openNow: count,
    pendingPreparation: count,
    preparingCount: count,
  }),
  sessionTrends: z.discriminatedUnion("state", [
    z.strictObject({ state: z.literal("unavailable") }),
    z.strictObject({
      state: z.literal("available"),
      windows: z
        .array(
          z.strictObject({
            hourCount: z.union([z.literal(3), z.literal(4)]),
            hours: z.array(z.number().finite()).min(3).max(4),
            rows: z
              .array(
                z.strictObject({
                  id: z.enum(["referrals", "accepted", "declined", "arrivals", "departures"]),
                  label: publicLabel,
                  counts: z.array(foundationCount).min(3).max(4),
                  total: foundationCount,
                }),
              )
              .length(5),
            counted: foundationCount,
          }),
        )
        .length(2),
    }),
  ]),
  catalogue: z.strictObject({
    sites: z.array(z.strictObject({ code: publicLabel, name: publicLabel, service: z.enum(HEALTH_SERVICES) })),
  }),
  wards: z.array(wardSummary),
  emergencyDepartments: z.array(edSummary),
  openableEmergencyDepartmentIds: z.array(publicLabel),
  openableCommunityTeamIds: z.array(publicLabel),
  openableServiceIds: z.array(z.enum(HEALTH_SERVICES)),
  edIndex: z.strictObject({
    waiting: foundationCount,
    unplaced: foundationCount,
    urgent: foundationCount,
    over24: foundationCount,
    over48: foundationCount,
    stillInEd: foundationCount,
    inTransit: foundationCount,
    bands: z.array(countBand).length(ED_WAIT_BANDS.length),
  }),
  services: z.array(serviceSummary).max(HEALTH_SERVICES.length),
  teams: z.array(teamSummary).max(1000),
  sites: z.array(siteSummary).max(1000),
  journey: z
    .array(
      z.strictObject({
        id: z.enum(["waiting", "referred", "accepted", "moving", "ward", "planned", "discharged"]),
        label: publicLabel,
        caption: publicLabel,
        tone: z.enum(["neutral", "success", "info"]),
        figure: journeyValue,
        breakdown: z.array(z.strictObject({ label: publicLabel, figure: journeyValue })).max(10),
      }),
    )
    .length(7),
  networkDetails: z.strictObject({
    physicalWaiting: foundationCount,
    listedEdJourneys: foundationCount,
    listedPhysicalWaiting: foundationCount,
    listedOver8h: foundationCount,
    listedOver24h: foundationCount,
    urgentOpen: foundationCount,
    unplacedOpen: foundationCount,
    over8h: foundationCount,
    over24h: foundationCount,
    medianWaitMinutes: duration,
    pooledAverageStayDays: duration,
    blockedTotal: foundationCount,
    longStayTotal: foundationCount,
    todayBedReferrals: z.strictObject({
      raised: foundationCount,
      accepted: foundationCount,
      declined: foundationCount,
      open: foundationCount,
    }),
    arrivalBands: z
      .array(
        z.strictObject({
          id: z.enum(["half-hold", "hold", "twice-hold", "longer"]),
          label: publicLabel,
          count: foundationCount,
        }),
      )
      .length(4),
    arrivals: z.strictObject({
      measuredCount: foundationCount,
      averageMinutes: duration,
      shortestMinutes: duration,
      longestMinutes: duration,
      endedCount: foundationCount,
      awaitingArrivalCount: foundationCount,
      incoherentCount: foundationCount,
    }),
    referralJoin: z.strictObject({
      withReferralIdCount: foundationCount,
      joinedCount: foundationCount,
      chronologicallyCoherentCount: foundationCount,
      referralsSearchedCount: foundationCount,
    }),
    declines: z.strictObject({
      total: foundationCount,
      movementsWithDeclines: foundationCount,
      movementsExamined: foundationCount,
      byReason: z.array(reasonCount).max(40),
    }),
    blocked: z.strictObject({
      total: foundationCount,
      admissionsExamined: foundationCount,
      byReason: z.array(reasonCount).max(40),
    }),
  }),
  community: z.strictObject({
    admitted: foundationCount,
    expected: foundationCount,
    dueOutWeek: foundationCount,
    noTeamInBed: foundationCount,
    unlinkedAdmissions: foundationCount,
    admissionsRecorded: foundationCount,
    activeTeams: count,
    emptyTeams: count,
    unknownTeams: count,
  }),
  referralMatrix: z
    .array(z.strictObject({ from: z.enum(HEALTH_SERVICES), to: z.enum(HEALTH_SERVICES), count: foundationCount }))
    .max(HEALTH_SERVICES.length ** 2),
  weeks: z.array(weeklySummary).length(9),
});

export type ExecutiveReportingFoundation = z.infer<typeof reportingFoundation>;
export type ExecutiveReportingWard = z.infer<typeof wardSummary>;
export type ExecutiveReportingEd = z.infer<typeof edSummary>;
export type ExecutiveReportingWeek = z.infer<typeof weeklySummary>;

/** Deep network seam; the lean React holder deliberately does not import this validator. */
export function isExecutiveReportingFoundation(value: unknown): value is ExecutiveReportingFoundation {
  const result = reportingFoundation.safeParse(value);
  if (!result.success) return false;
  const dto = result.data;
  // The legacy standalone Network foundation has a deliberately stricter family fallback.
  // The complete bundle is released once by ExecutiveCountRelease, so validate its positive
  // wire shape here rather than applying that historical per-family decision a second time.
  if (!networkAggregate.safeParse(dto.network).success) return false;
  const unique = (values: readonly string[]) => new Set(values).size === values.length;
  if (
    !unique(dto.wards.map((ward) => ward.id)) ||
    !unique(dto.emergencyDepartments.map((ed) => ed.id)) ||
    !unique(dto.catalogue.sites.map((site) => site.code)) ||
    !unique(dto.services.map((entry) => entry.service)) ||
    !unique(dto.teams.map((entry) => entry.id)) ||
    !unique(dto.referralMatrix.map((entry) => `${entry.from}|${entry.to}`))
  )
    return false;
  if (dto.wards.length !== dto.network.wards.length) return false;
  const sites = new Map(dto.catalogue.sites.map((site) => [site.code, site]));
  for (const entry of [...dto.wards, ...dto.emergencyDepartments]) {
    if (sites.get(entry.siteCode)?.service !== entry.service) return false;
  }
  const reportingScope = dto.network.scope;
  if (reportingScope.kind === "service" && dto.wards.some((ward) => ward.service !== reportingScope.service))
    return false;
  const publicSites = new Map(siteDirectory.map((site) => [site.code, site]));
  if (
    dto.catalogue.sites.length !== publicSites.size ||
    dto.catalogue.sites.some(
      (site) => publicSites.get(site.code)?.name !== site.name || publicSites.get(site.code)?.service !== site.service,
    )
  )
    return false;
  const publicEds = allEmergencyDepartments();
  if (
    dto.emergencyDepartments.length !== publicEds.length ||
    dto.emergencyDepartments.some(
      (ed) =>
        !publicEds.some((known) => known.id === ed.id && known.name === ed.name && known.siteCode === ed.siteCode),
    )
  )
    return false;
  const openable = dto.emergencyDepartments
    .filter((ed) => reportingScope.kind === "statewide" || ed.service === reportingScope.service)
    .map((ed) => ed.id);
  if (
    dto.openableEmergencyDepartmentIds.length !== openable.length ||
    !unique(dto.openableEmergencyDepartmentIds) ||
    dto.openableEmergencyDepartmentIds.some((id) => !openable.includes(id))
  )
    return false;
  if (
    dto.services.length !== HEALTH_SERVICES.length ||
    dto.services.some((entry) => !HEALTH_SERVICES.includes(entry.service))
  )
    return false;
  const openableServices = HEALTH_SERVICES.filter(
    (service) => reportingScope.kind === "statewide" || service === reportingScope.service,
  );
  if (
    dto.openableServiceIds.length !== openableServices.length ||
    !unique(dto.openableServiceIds) ||
    dto.openableServiceIds.some((service) => !openableServices.includes(service))
  )
    return false;
  if (
    !unique(dto.sites.map((site) => site.code)) ||
    dto.sites.some((site) => sites.get(site.code)?.service !== site.service)
  )
    return false;
  if (
    dto.referralMatrix.length !== dto.services.length * HEALTH_SERVICES.length ||
    dto.referralMatrix.some((cell) => !dto.services.some((entry) => entry.service === cell.from))
  )
    return false;
  if (
    dto.teams.length !== COMMUNITY_TEAM_PAGES.length ||
    dto.teams.some((team) => !COMMUNITY_TEAM_PAGES.some((entry) => entry.id === team.id && entry.name === team.name))
  )
    return false;
  const openableTeams = dto.teams
    .filter((team) => reportingScope.kind === "statewide" || team.service === reportingScope.service)
    .map((team) => team.id);
  if (
    dto.openableCommunityTeamIds.length !== openableTeams.length ||
    !unique(dto.openableCommunityTeamIds) ||
    dto.openableCommunityTeamIds.some((id) => !openableTeams.includes(id))
  )
    return false;
  if (dto.edIndex.bands.some((band, index) => band.label !== ED_WAIT_BANDS[index]?.label)) return false;
  if (dto.sessionTrends.state === "available") {
    const ids = ["referrals", "accepted", "declined", "arrivals", "departures"];
    const labels = ["Referred", "Accepted", "Declined", "Arrived", "Left"];
    if (
      dto.sessionTrends.windows.some(
        (window, index) =>
          window.hourCount !== index + 3 ||
          window.hours.length !== window.hourCount ||
          window.rows.some(
            (row, rowIndex) =>
              row.id !== ids[rowIndex] || row.label !== labels[rowIndex] || row.counts.length !== window.hourCount,
          ),
      )
    )
      return false;
    const currentHour = Math.floor(dto.network.asAt.now / 60) * 60;
    if (
      dto.sessionTrends.windows.some((window) =>
        window.hours.some((hour, index) => hour !== currentHour - (window.hourCount - 1 - index) * 60),
      )
    )
      return false;
  }
  if (
    dto.networkDetails.declines.byReason.length !== DECLINE_REASONS.length ||
    dto.networkDetails.declines.byReason.some((entry, index) => entry.reason !== DECLINE_REASONS[index])
  )
    return false;
  if (
    dto.networkDetails.blocked.byReason.length !== BED_RELEASE_BLOCKERS.length ||
    dto.networkDetails.blocked.byReason.some((entry, index) => entry.reason !== BED_RELEASE_BLOCKERS[index])
  )
    return false;
  if (
    dto.services.some(
      (entry) =>
        entry.farFromHome.bands.length !== OUT_OF_AREA_BANDS.length ||
        entry.farFromHome.bands.some((band, index) => band.label !== TRAVEL_BAND_LABELS[OUT_OF_AREA_BANDS[index]!]),
    )
  )
    return false;
  if (
    dto.emergencyDepartments.some(
      (ed) =>
        ed.bands.length !== ED_WAIT_BANDS.length ||
        ed.bands.some((band, index) => band.label !== ED_WAIT_BANDS[index]?.label),
    )
  )
    return false;
  for (const ward of dto.wards) {
    if (
      ward.stayBands.length !== STAY_BANDS.length ||
      ward.stayBands.some(
        (entry, index) => entry.id !== STAY_BANDS[index]?.id || entry.label !== STAY_BANDS[index]?.label,
      ) ||
      ward.dueByDay.some((day, index) => day.offset !== index)
    )
      return false;
    if (ward.readyToLeave.byReason.some((entry) => !reasonCodes.has(entry.reason))) return false;
    const networkWard = dto.network.wards.find((entry) => entry.id === ward.id);
    if (
      !networkWard ||
      networkWard.name !== ward.name ||
      networkWard.siteCode !== ward.siteCode ||
      networkWard.service !== ward.service
    )
      return false;
    if (
      Object.keys(ward.beds).some(
        (key) => ward.beds[key as keyof ExecutiveBedCounts] !== networkWard.beds[key as keyof ExecutiveBedCounts],
      )
    )
      return false;
  }
  return dto.weeks.every(({ week, pilot, report }, index) => {
    const expected = reportWeek(index - 1, dto.network.asAt.now, new Date(dto.network.asAt.dayZero));
    return (
      report.declines.byReason.every((entry) => weeklyDeclineLabels.has(entry.reason)) &&
      report.overrides.byReason.every((entry) => weeklyOverrideLabels.has(entry.reason)) &&
      week.offset === expected.offset &&
      week.start === expected.start &&
      week.end === expected.end &&
      week.countedEnd === expected.countedEnd &&
      pilot.steps.map((step) => step.id).join(",") === "ask,answer,hold,leave,travel"
    );
  });
}
