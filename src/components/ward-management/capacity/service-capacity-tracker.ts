import { clockState, type Instant } from "@/components/ward-management/ward-clock";
import { openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { isOpen, unitCapacity } from "@/components/ward-management/ward-derivations";
import { elapsedOpenMinutes, isDetainedUnderTheAct } from "@/components/ward-management/ed/ed-home-derivations";
import {
  HEALTH_SERVICES,
  type BedRelease,
  type EmergencyDepartment,
  type HealthService,
  type Movement,
  type Site,
  type Unit,
} from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";
import {
  ED_ELEVATED_PRESSURE_WAIT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  OCCUPANCY_ALERT_PERCENT,
  OCCUPANCY_SURGE_PERCENT,
  OCCUPANCY_CRITICAL_PERCENT,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";

/** North / South / East Metro only — standard metropolitan reporting grouping in WA Health. */
export const METRO_HEALTH_SERVICES: readonly HealthService[] = ["North Metro", "South Metro", "East Metro"];

/*
 * There is one ED access target: the one configured in Settings
 * (`state.configuration.edAccessTargetMinutes`). This module used to carry its own hidden 4-hour
 * fallback; Josh removed it (26 Sept 2026, "All yes", question 2). With no target passed, nobody is
 * counted as past it and the words say the target is not recorded.
 */
const TARGET_NOT_RECORDED = "access target not recorded";

/** Extended ED boarding threshold — kept as an alias for existing importers; see
 *  `ED_SEVERE_PRESSURE_WAIT_MINUTES` in `ward-operational-defaults.ts` for the value and its label. */
export const WA_ED_EXTENDED_WAIT_MINUTES = ED_SEVERE_PRESSURE_WAIT_MINUTES;

/** Operational warning tone: Green (normal), Yellow (amber alert), Red (high surge), Black (critical gridlock). */
export type CapacityAlertCode = "green" | "yellow" | "red" | "black";

/** Metrics for an emergency department within a hospital site. */
export interface HospitalEdMetrics {
  edId: string;
  edName: string;
  siteCode: string;
  waitingCount: number;
  longestWaitMinutes: number;
  detainedCount: number;
  pastAccessTargetCount: number;
  detainedAndPastAccessTargetCount: number;
  statutoryBreachCount: number;
  warningLevel: CapacityAlertCode;
  warningLabel: string;
  warningMessage: string;
}

/** Tracking details for a single hospital / facility site. */
export interface HospitalBedTracking {
  hospitalCode: string;
  hospitalName: string;
  service: HealthService;
  hasEmergencyDepartment: boolean;
  hasInpatientUnits: boolean;
  unitCount: number;
  totalBeds: number;
  occupiedBeds: number;
  remainingBeds: number;
  remainingCapacityPercent: number;
  occupancyPercent: number;
  warningLevel: CapacityAlertCode;
  warningLabel: string;
  edMetrics?: HospitalEdMetrics;
}

/** Aggregated ED summary for a health service provider. */
export interface ServiceEdSummary {
  departmentsCount: number;
  totalWaiting: number;
  longestWaitMinutes: number;
  totalDetained: number;
  totalPastAccessTarget: number;
  totalDetainedAndPastAccessTarget: number;
  totalStatutoryBreaches: number;
  warningLevel: CapacityAlertCode;
  warningLabel: string;
  clinicalAdvisory: string;
}

/** Compound escalation alert combining inpatient bed capacity and ED pressure. */
export interface CompoundEscalationAlert {
  level: CapacityAlertCode;
  protocolTier:
    "Level 1 (Standard)" | "Level 2 (Amber Alert)" | "Level 3 (Red Escalation)" | "Level 4 (Black Gridlock)";
  title: string;
  description: string;
  actionRequired: boolean;
}

/** Complete capacity and warning tracking for a Health Service. */
export interface ServiceCapacityTracking {
  id: string;
  service: HealthService;
  shortName: HealthService;
  hospitalCodes: string[];
  facilitiesList: string;
  hospitals: HospitalBedTracking[];
  totalBeds: number;
  occupiedBeds: number;
  remainingBeds: number;
  remainingCapacityPercent: number;
  occupancyPercent: number;
  capacityWarningLevel: CapacityAlertCode;
  capacityWarningLabel: string;
  edSummary: ServiceEdSummary;
  compoundEscalation: CompoundEscalationAlert;
}

/** Network-wide capacity report covering metro and statewide aggregates. */
export interface StatewideCapacityReport {
  services: ServiceCapacityTracking[];
  totalFreeBeds: number;
  totalBeds: number;
  totalOccupiedBeds: number;
  statewideRemainingCapacityPercent: number;
  statewideOccupancyPercent: number;
  metroOccupancyPercent: number | null;
  metroRemainingCapacityPercent: number | null;
  metroTotalBeds: number;
  metroOccupiedBeds: number;
  metroFreeBeds: number;
  metroEdSummary: ServiceEdSummary;
  mostPressingService: ServiceCapacityTracking | null;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function serviceSlug(service: HealthService): string {
  return service.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Derives the capacity warning tone based on remaining bed capacity and occupancy percentage.
 * Thresholds aligned with WA Health operational bed management:
 * - Green (Normal): > 10% remaining capacity (< 90% occupancy)
 * - Yellow (Alert): 5.1% - 10.0% remaining capacity (90.0% - 94.9% occupancy)
 * - Red (Surge): 2.1% - 5.0% remaining capacity (95.0% - 97.9% occupancy)
 * - Black (Critical): <= 2.0% remaining capacity (>= 98.0% occupancy or <= 1 free bed)
 */
export function deriveBedCapacityTone(
  totalBeds: number,
  freeBeds: number,
): {
  code: CapacityAlertCode;
  label: string;
  remainingPercent: number;
  occupancyPercent: number;
} {
  if (totalBeds === 0) {
    return {
      code: "green",
      label: "No Inpatient Beds",
      remainingPercent: 0,
      occupancyPercent: 0,
    };
  }

  const remainingPercent = roundOneDecimal((freeBeds / totalBeds) * 100);
  const occupiedBeds = Math.max(0, totalBeds - freeBeds);
  const occupancyPercent = roundOneDecimal((occupiedBeds / totalBeds) * 100);

  let code: CapacityAlertCode = "green";
  if (occupancyPercent >= OCCUPANCY_CRITICAL_PERCENT || freeBeds <= 1) {
    code = "black";
  } else if (occupancyPercent >= OCCUPANCY_SURGE_PERCENT || remainingPercent <= 100 - OCCUPANCY_SURGE_PERCENT) {
    code = "red";
  } else if (occupancyPercent >= OCCUPANCY_ALERT_PERCENT || remainingPercent <= 100 - OCCUPANCY_ALERT_PERCENT) {
    code = "yellow";
  }

  return {
    code,
    label: `${occupancyPercent}%`,
    remainingPercent,
    occupancyPercent,
  };
}

/**
 * Derives the ED capacity warning tone based on mental health presentations, wait times, and
 * how many patients are past the (configured, not statutory) access target.
 *
 * `statutoryBreachCount` is accepted for callers that still compute it, but no longer drives any
 * part of this tone: a recorded legal-form deadline is not the same thing as an access-target
 * default, and describing it as a trigger here claimed a legal limit this function cannot verify.
 * Owner ruling 26 September 2026 (decisions.md D-22) took that wording and that trigger out.
 */
export function deriveEdWarning(
  waitingCount: number,
  longestWaitMinutes: number,
  detainedCount: number,
  pastAccessTargetCount: number,
  statutoryBreachCount: number,
  freeInpatientBeds: number,
  /** The configured ED access target (`state.configuration.edAccessTargetMinutes`), used only to
   *  word the figures below. Undefined when none is configured. */
  accessTargetMinutes?: number,
): {
  code: CapacityAlertCode;
  label: string;
  message: string;
} {
  if (waitingCount === 0) {
    return {
      code: "green",
      label: "Normal Flow",
      message: "0 mental health presentations waiting.",
    };
  }

  const pastTargetWords =
    accessTargetMinutes === undefined ? TARGET_NOT_RECORDED : `past ${accessTargetMinutes / 60}h target`;

  // Black (Critical Gridlock): wait beyond the severe-pressure default, or multiple past-target
  // patients with 0 beds available.
  if (longestWaitMinutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES || (pastAccessTargetCount >= 2 && freeInpatientBeds === 0)) {
    const hours = Math.floor(longestWaitMinutes / 60);
    const mins = longestWaitMinutes % 60;
    return {
      code: "black",
      label: "Critical Bed Block",
      message: `Severe ED access block: longest wait ${hours}h ${mins}m, ${pastAccessTargetCount} ${pastTargetWords}, ${freeInpatientBeds} free beds in service. Thresholds are ${OPERATIONAL_DEFAULT_LABEL}.`,
    };
  }

  // Red (High Alert): any patient past the access target, or 5+ waiting.
  if (pastAccessTargetCount > 0 || waitingCount >= 5) {
    const reason =
      pastAccessTargetCount > 0 ? `${pastAccessTargetCount} ${pastTargetWords}` : `${waitingCount} waiting for admission`;
    return {
      code: "red",
      label: "Past access target",
      message: `ED capacity alert: ${reason} (${OPERATIONAL_DEFAULT_LABEL}).`,
    };
  }

  // Yellow (Amber Alert / Elevated Pressure): 3-4 waiting, or longest wait at or past the
  // elevated-pressure default, or a detained patient.
  if (waitingCount >= 3 || longestWaitMinutes >= ED_ELEVATED_PRESSURE_WAIT_MINUTES || detainedCount > 0) {
    return {
      code: "yellow",
      label: "Elevated Pressure",
      message: `${waitingCount} waiting in ED (longest wait ${Math.floor(longestWaitMinutes / 60)}h ${longestWaitMinutes % 60}m). ${detainedCount} detained under the Act.`,
    };
  }

  // Green (Standard Flow): 1-2 waiting, all < 3 hours
  return {
    code: "green",
    label: "Flow Manageable",
    message: `${waitingCount} waiting in ED (under ${ED_ELEVATED_PRESSURE_WAIT_MINUTES / 60}h, ${OPERATIONAL_DEFAULT_LABEL}). Flow manageable.`,
  };
}

/**
 * Evaluates compound escalation (OPIS Tier) combining inpatient remaining capacity and ED boarding.
 * In WA Health, the true crisis is when ED capacity is breached AND inpatient beds are scarce.
 */
export function evaluateCompoundEscalation(
  service: HealthService,
  bedCode: CapacityAlertCode,
  remainingBeds: number,
  remainingPercent: number,
  edSummary: ServiceEdSummary,
): CompoundEscalationAlert {
  // Severe Gridlock: Inpatient Black or ED Black, or Inpatient Red + ED Red
  if (
    bedCode === "black" ||
    edSummary.warningLevel === "black" ||
    (bedCode === "red" && edSummary.warningLevel === "red")
  ) {
    return {
      level: "black",
      protocolTier: "Level 4 (Black Gridlock)",
      title: `${service} Full Capacity Protocol Level 4`,
      description: `Critical access block: ${remainingBeds} free beds (${remainingPercent}% capacity) with ${edSummary.totalWaiting} waiting in ED (${edSummary.totalPastAccessTarget} past target). Immediate executive bed diversion protocol active.`,
      actionRequired: true,
    };
  }

  // High Escalation: Inpatient Red OR ED Red
  if (bedCode === "red" || edSummary.warningLevel === "red") {
    return {
      level: "red",
      protocolTier: "Level 3 (Red Escalation)",
      title: `${service} Capacity Escalation Level 3`,
      description: `Surge alert: ${remainingBeds} free beds (${remainingPercent}% capacity) with ${edSummary.totalWaiting} waiting in ED (${edSummary.totalPastAccessTarget} past target). Proactive discharge and inter-site transfer required.`,
      actionRequired: true,
    };
  }

  // Amber Alert: Inpatient Yellow OR ED Yellow
  if (bedCode === "yellow" || edSummary.warningLevel === "yellow") {
    return {
      level: "yellow",
      protocolTier: "Level 2 (Amber Alert)",
      title: `${service} Capacity Alert Level 2`,
      description: `Capacity constrained: ${remainingBeds} free beds (${remainingPercent}% capacity), ${edSummary.totalWaiting} waiting in ED. Review pending discharges and expedited reviews.`,
      actionRequired: false,
    };
  }

  return {
    level: "green",
    protocolTier: "Level 1 (Standard)",
    title: `${service} Standard Operations`,
    description: `Bed flow stable: ${remainingBeds} free beds (${remainingPercent}% capacity), ED flow manageable.`,
    actionRequired: false,
  };
}

/**
 * Generates the full capacity and hospital tracking report across all health services.
 */
export function trackServiceBedCapacity(
  units: readonly Unit[],
  bedReleases: readonly BedRelease[],
  movements: readonly Movement[] = [],
  now: Instant = 0,
  sites: readonly Site[] = wardSites,
  /** The configured ED access target; undefined when none is configured (nobody counted past it). */
  accessTargetMinutes?: number,
): StatewideCapacityReport {
  const releases = [...bedReleases];
  const serviceTrackings: ServiceCapacityTracking[] = [];

  for (const service of HEALTH_SERVICES) {
    const serviceSites = sites.filter((site) => site.service === service);
    if (serviceSites.length === 0) continue;

    const siteCodes = new Set(serviceSites.map((site) => site.code));
    const serviceUnits = units.filter((unit) => siteCodes.has(unit.siteCode));
    if (serviceUnits.length === 0) continue;

    const hospitalTrackings: HospitalBedTracking[] = [];
    let serviceTotalBeds = 0;
    let serviceFreeBeds = 0;
    let serviceOccupiedBeds = 0;

    let serviceEdWaiting = 0;
    let serviceEdLongestWait = 0;
    let serviceEdDetained = 0;
    let serviceEdPastTarget = 0;
    let serviceEdDetainedPastTarget = 0;
    let serviceEdStatutoryBreaches = 0;
    let serviceEdDeptsCount = 0;

    for (const site of serviceSites) {
      const siteUnits = units.filter((u) => u.siteCode === site.code);
      let siteFree = 0;
      let siteTotal = 0;
      let siteOccupiedBeds = 0;

      for (const u of siteUnits) {
        siteFree += openBedsNow(u, releases);
        siteTotal += u.beds;
        // Occupied is the board's own bucket (Josh, 25 Sept 2026: the rail matches the board). It was
        // `total - free`, which counted held, blocked and being-cleaned beds as occupied.
        siteOccupiedBeds += unitCapacity(u, releases).occupied;
      }

      serviceTotalBeds += siteTotal;
      serviceFreeBeds += siteFree;
      serviceOccupiedBeds += siteOccupiedBeds;

      const siteOccupied = siteOccupiedBeds;
      const siteRemainingPercent = siteTotal > 0 ? roundOneDecimal((siteFree / siteTotal) * 100) : 0;
      const siteOccupancyPercent = siteTotal > 0 ? roundOneDecimal((siteOccupied / siteTotal) * 100) : 0;
      const siteTone = deriveBedCapacityTone(siteTotal, siteFree);

      let edMetrics: HospitalEdMetrics | undefined;
      if (site.emergencyDepartment) {
        serviceEdDeptsCount++;
        const ed = site.emergencyDepartment;
        const openMovements = movements.filter((m) => isOpen(m) && m.originEdId === ed.id);
        const elapsedTimes = openMovements.map((m) => elapsedOpenMinutes(m, now));
        const longest = elapsedTimes.length > 0 ? Math.max(...elapsedTimes) : 0;
        const detained = openMovements.filter((m) => isDetainedUnderTheAct(m.legalStatus)).length;
        const pastTarget =
          accessTargetMinutes === undefined ? 0 : elapsedTimes.filter((mins) => mins >= accessTargetMinutes).length;
        const detainedPastTarget =
          accessTargetMinutes === undefined
            ? 0
            : openMovements.filter(
                (m, idx) => isDetainedUnderTheAct(m.legalStatus) && elapsedTimes[idx] >= accessTargetMinutes,
              ).length;
        const statutoryBreaches = openMovements.filter(
          (m) => m.legalForm?.dueAt !== undefined && clockState(m.legalForm.dueAt, now) === "breached",
        ).length;

        serviceEdWaiting += openMovements.length;
        if (longest > serviceEdLongestWait) {
          serviceEdLongestWait = longest;
        }
        serviceEdDetained += detained;
        serviceEdPastTarget += pastTarget;
        serviceEdDetainedPastTarget += detainedPastTarget;
        serviceEdStatutoryBreaches += statutoryBreaches;

        const edTone = deriveEdWarning(
          openMovements.length,
          longest,
          detained,
          pastTarget,
          statutoryBreaches,
          siteFree,
          accessTargetMinutes,
        );

        edMetrics = {
          edId: ed.id,
          edName: ed.name,
          siteCode: site.code,
          waitingCount: openMovements.length,
          longestWaitMinutes: longest,
          detainedCount: detained,
          pastAccessTargetCount: pastTarget,
          detainedAndPastAccessTargetCount: detainedPastTarget,
          statutoryBreachCount: statutoryBreaches,
          warningLevel: edTone.code,
          warningLabel: edTone.label,
          warningMessage: edTone.message,
        };
      }

      hospitalTrackings.push({
        hospitalCode: site.code,
        hospitalName: site.name,
        service,
        hasEmergencyDepartment: Boolean(site.emergencyDepartment),
        hasInpatientUnits: siteUnits.length > 0,
        unitCount: siteUnits.length,
        totalBeds: siteTotal,
        occupiedBeds: siteOccupied,
        remainingBeds: siteFree,
        remainingCapacityPercent: siteRemainingPercent,
        occupancyPercent: siteOccupancyPercent,
        warningLevel: siteTone.code,
        warningLabel: siteTone.label,
        edMetrics,
      });
    }

    // Skip a service with zero total beds and zero units (unless configured)
    if (serviceTotalBeds === 0 && hospitalTrackings.every((h) => !h.hasInpatientUnits)) {
      continue;
    }

    const serviceOccupied = serviceOccupiedBeds;
    const serviceRemainingPercent =
      serviceTotalBeds > 0 ? roundOneDecimal((serviceFreeBeds / serviceTotalBeds) * 100) : 0;
    const serviceOccupancyPercent =
      serviceTotalBeds > 0 ? roundOneDecimal((serviceOccupied / serviceTotalBeds) * 100) : 0;
    const serviceBedTone = deriveBedCapacityTone(serviceTotalBeds, serviceFreeBeds);

    const edServiceTone = deriveEdWarning(
      serviceEdWaiting,
      serviceEdLongestWait,
      serviceEdDetained,
      serviceEdPastTarget,
      serviceEdStatutoryBreaches,
      serviceFreeBeds,
      accessTargetMinutes,
    );

    const edSummary: ServiceEdSummary = {
      departmentsCount: serviceEdDeptsCount,
      totalWaiting: serviceEdWaiting,
      longestWaitMinutes: serviceEdLongestWait,
      totalDetained: serviceEdDetained,
      totalPastAccessTarget: serviceEdPastTarget,
      totalDetainedAndPastAccessTarget: serviceEdDetainedPastTarget,
      totalStatutoryBreaches: serviceEdStatutoryBreaches,
      warningLevel: edServiceTone.code,
      warningLabel: edServiceTone.label,
      clinicalAdvisory: edServiceTone.message,
    };

    const compoundEscalation = evaluateCompoundEscalation(
      service,
      serviceBedTone.code,
      serviceFreeBeds,
      serviceRemainingPercent,
      edSummary,
    );

    serviceTrackings.push({
      id: serviceSlug(service),
      service,
      shortName: service,
      hospitalCodes: serviceSites.map((site) => site.code),
      facilitiesList: serviceSites.map((site) => site.name).join(" · "),
      hospitals: hospitalTrackings,
      totalBeds: serviceTotalBeds,
      occupiedBeds: serviceOccupied,
      remainingBeds: serviceFreeBeds,
      remainingCapacityPercent: serviceRemainingPercent,
      occupancyPercent: serviceOccupancyPercent,
      capacityWarningLevel: serviceBedTone.code,
      capacityWarningLabel: serviceBedTone.label,
      edSummary,
      compoundEscalation,
    });
  }

  // Statewide totals
  const totalFreeBeds = serviceTrackings.reduce((sum, s) => sum + s.remainingBeds, 0);
  const totalBeds = serviceTrackings.reduce((sum, s) => sum + s.totalBeds, 0);
  const totalOccupiedBeds = serviceTrackings.reduce((sum, s) => sum + s.occupiedBeds, 0);
  const statewideRemainingCapacityPercent = totalBeds > 0 ? roundOneDecimal((totalFreeBeds / totalBeds) * 100) : 0;
  const statewideOccupancyPercent = totalBeds > 0 ? roundOneDecimal((totalOccupiedBeds / totalBeds) * 100) : 0;

  // Metro-only figures (North Metro, South Metro, East Metro)
  let metroOccupied = 0;
  let metroTotal = 0;
  let metroFree = 0;
  let metroEdWaiting = 0;
  let metroEdLongestWait = 0;
  let metroEdDetained = 0;
  let metroEdPastTarget = 0;
  let metroEdDetainedPastTarget = 0;
  let metroEdStatutoryBreaches = 0;
  let metroEdDeptsCount = 0;

  for (const s of serviceTrackings) {
    if (!(METRO_HEALTH_SERVICES as readonly string[]).includes(s.service)) continue;
    metroOccupied += s.occupiedBeds;
    metroTotal += s.totalBeds;
    metroFree += s.remainingBeds;

    metroEdDeptsCount += s.edSummary.departmentsCount;
    metroEdWaiting += s.edSummary.totalWaiting;
    if (s.edSummary.longestWaitMinutes > metroEdLongestWait) {
      metroEdLongestWait = s.edSummary.longestWaitMinutes;
    }
    metroEdDetained += s.edSummary.totalDetained;
    metroEdPastTarget += s.edSummary.totalPastAccessTarget;
    metroEdDetainedPastTarget += s.edSummary.totalDetainedAndPastAccessTarget;
    metroEdStatutoryBreaches += s.edSummary.totalStatutoryBreaches;
  }

  const metroOccupancyPercent = metroTotal > 0 ? roundOneDecimal((metroOccupied / metroTotal) * 100) : null;
  const metroRemainingCapacityPercent = metroTotal > 0 ? roundOneDecimal((metroFree / metroTotal) * 100) : null;

  const metroEdTone = deriveEdWarning(
    metroEdWaiting,
    metroEdLongestWait,
    metroEdDetained,
    metroEdPastTarget,
    metroEdStatutoryBreaches,
    metroFree,
    accessTargetMinutes,
  );

  const metroEdSummary: ServiceEdSummary = {
    departmentsCount: metroEdDeptsCount,
    totalWaiting: metroEdWaiting,
    longestWaitMinutes: metroEdLongestWait,
    totalDetained: metroEdDetained,
    totalPastAccessTarget: metroEdPastTarget,
    totalDetainedAndPastAccessTarget: metroEdDetainedPastTarget,
    totalStatutoryBreaches: metroEdStatutoryBreaches,
    warningLevel: metroEdTone.code,
    warningLabel: metroEdTone.label,
    clinicalAdvisory: metroEdTone.message,
  };

  const priorityScore: Record<CapacityAlertCode, number> = {
    black: 4,
    red: 3,
    yellow: 2,
    green: 1,
  };

  const mostPressingService =
    serviceTrackings.length === 0
      ? null
      : serviceTrackings.reduce((highest, current) => {
          // Worst compound escalation level wins
          const currentEscScore = priorityScore[current.compoundEscalation.level] ?? 0;
          const highestEscScore = priorityScore[highest.compoundEscalation.level] ?? 0;
          if (currentEscScore > highestEscScore) return current;
          if (currentEscScore < highestEscScore) return highest;

          // Highest occupancy wins next
          if (current.occupancyPercent > highest.occupancyPercent) return current;
          if (current.occupancyPercent < highest.occupancyPercent) return highest;

          // Worst bed warning wins
          const currentBedScore = priorityScore[current.capacityWarningLevel] ?? 0;
          const highestBedScore = priorityScore[highest.capacityWarningLevel] ?? 0;
          return currentBedScore > highestBedScore ? current : highest;
        });

  return {
    services: serviceTrackings,
    totalFreeBeds,
    totalBeds,
    totalOccupiedBeds,
    statewideRemainingCapacityPercent,
    statewideOccupancyPercent,
    metroOccupancyPercent,
    metroRemainingCapacityPercent,
    metroTotalBeds: metroTotal,
    metroOccupiedBeds: metroOccupied,
    metroFreeBeds: metroFree,
    metroEdSummary,
    mostPressingService,
  };
}
