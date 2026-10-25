import { z } from "zod";
import { HEALTH_SERVICES } from "../ward-model";
import { CLINICAL_VALUES } from "../ward-clinical-values";
import { ED_WAIT_BANDS } from "./statistics-ed-waits";
import { reportWeek } from "../reports/weekly-report";

/** Foundation only. No server or screen adopts this payload until its full reporting contract is ready. */
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const releasedCount = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("exact"), value: count }),
  z.strictObject({ kind: z.literal("small") }),
  z.strictObject({ kind: z.literal("withheld") }),
]);

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

/** Unfinished release graph: protect every positive count until cross-route complements are proved.
 * This is a conservative, inactive foundation limit, not the final reporting policy. */
const foundationCount = z.union([
  z.strictObject({ kind: z.literal("exact"), value: z.literal(0) }),
  z.strictObject({ kind: z.literal("withheld") }),
]);
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
  longestWaitMinutes: duration,
  bands: z.array(z.strictObject({ label: publicLabel, count: foundationCount })),
});
const reportWeekSchema = z.strictObject({
  offset: z.number().int().min(-1).max(7),
  start: z.number().finite(),
  end: z.number().finite(),
  countedEnd: z.number().finite(),
});
const pairedCounts = z.strictObject({ placement: foundationCount, referral: foundationCount });
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

export const EXECUTIVE_REPORTING_OMITTED_FAMILIES = [
  "community-membership",
  "network-map-journey",
  "compare-controls-and-reference-figures",
  "ward-and-ed-reason-breakdowns",
  "weekly-reason-breakdowns",
  "cross-route-numeric-release",
  "route-chrome-export-print-adoption",
] as const;

const reportingFoundation = z.strictObject({
  kind: z.literal("executive-reporting-foundation"),
  version: z.literal(1),
  coverage: z.literal("reporting-foundation"),
  omittedFamilies: z.tuple(
    EXECUTIVE_REPORTING_OMITTED_FAMILIES.map((family) => z.literal(family)) as [
      z.ZodLiteral<(typeof EXECUTIVE_REPORTING_OMITTED_FAMILIES)[number]>,
      ...z.ZodLiteral<(typeof EXECUTIVE_REPORTING_OMITTED_FAMILIES)[number]>[],
    ],
  ),
  network: networkAggregate,
  catalogue: z.strictObject({
    sites: z.array(z.strictObject({ code: publicLabel, name: publicLabel, service: z.enum(HEALTH_SERVICES) })),
  }),
  wards: z.array(wardSummary),
  emergencyDepartments: z.array(edSummary),
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
  if (!isExecutiveNetworkAggregate(dto.network)) return false;
  const counts = [...Object.values(dto.network.people), ...Object.values(dto.network.admissionStages)];
  if (counts.some((figure) => figure.kind !== "withheld" && (figure.kind !== "exact" || figure.value !== 0)))
    return false;
  const unique = (values: readonly string[]) => new Set(values).size === values.length;
  if (
    !unique(dto.wards.map((ward) => ward.id)) ||
    !unique(dto.emergencyDepartments.map((ed) => ed.id)) ||
    !unique(dto.catalogue.sites.map((site) => site.code))
  )
    return false;
  if (dto.wards.length !== dto.network.wards.length) return false;
  const sites = new Map(dto.catalogue.sites.map((site) => [site.code, site]));
  for (const entry of [...dto.wards, ...dto.emergencyDepartments]) {
    if (sites.get(entry.siteCode)?.service !== entry.service) return false;
    if (dto.network.scope.kind === "service" && entry.service !== dto.network.scope.service) return false;
  }
  const reportingScope = dto.network.scope;
  if (reportingScope.kind === "service" && dto.catalogue.sites.some((site) => site.service !== reportingScope.service))
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
  return dto.weeks.every(({ week, pilot }, index) => {
    const expected = reportWeek(index - 1, dto.network.asAt.now, new Date(dto.network.asAt.dayZero));
    return (
      week.offset === expected.offset &&
      week.start === expected.start &&
      week.end === expected.end &&
      week.countedEnd === expected.countedEnd &&
      pilot.steps.map((step) => step.id).join(",") === "ask,answer,hold,leave,travel"
    );
  });
}
