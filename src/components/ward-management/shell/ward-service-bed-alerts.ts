import {
  trackServiceBedCapacity,
  deriveBedCapacityTone,
  deriveEdWarning,
  evaluateCompoundEscalation,
  METRO_HEALTH_SERVICES,
  type CapacityAlertCode,
  type CompoundEscalationAlert,
  type HospitalBedTracking,
  type HospitalEdMetrics,
  type ServiceCapacityTracking,
  type ServiceEdSummary,
  type StatewideCapacityReport,
} from "@/components/ward-management/capacity/service-capacity-tracker";
import {
  type BedRelease,
  type HealthService,
  type Movement,
  type Site,
  type Unit,
} from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  OCCUPANCY_ALERT_PERCENT,
  OCCUPANCY_CRITICAL_PERCENT,
} from "@/components/ward-management/ward-operational-defaults";

export {
  METRO_HEALTH_SERVICES,
  trackServiceBedCapacity,
  deriveBedCapacityTone,
  deriveEdWarning,
  evaluateCompoundEscalation,
};

export type {
  CapacityAlertCode,
  CompoundEscalationAlert,
  HospitalBedTracking,
  HospitalEdMetrics,
  ServiceCapacityTracking,
  ServiceEdSummary,
  StatewideCapacityReport,
};

export type ServiceBedAlertCode = CapacityAlertCode;

export interface ServiceBedAlert {
  id: string;
  name: string;
  shortName: HealthService;
  facilities: string;
  /** Colour band only — tied to occupancy, not a clinical "Code Red" claim. */
  code: ServiceBedAlertCode;
  /** Computed short label: the occupancy percent itself. */
  codeLabel: string;
  occupancyPercent: number;
  occupiedBeds: number;
  totalBeds: number;
  freeBeds: number;
  /** Free and occupied counts only — no handwritten clinical story. */
  escalation: string;
  /** Official hospital codes for facilities within this service (e.g. ["SCGH", "KEMH", "PCH", "JHC", "GRY"]). */
  hospitalCodes?: string[];
  /** Service remaining bed capacity as a percentage (0 - 100%). */
  remainingCapacityPercent?: number;
  /** Detailed per-hospital breakdown including codes, beds, and ED presence. */
  hospitals?: HospitalBedTracking[];
  /** Aggregated ED capacity and pressure summary for this service. */
  edSummary?: ServiceEdSummary;
  /** Compound escalation assessment (combining Inpatient Capacity + ED Pressure). */
  compoundEscalation?: CompoundEscalationAlert;
}

export interface ServiceBedAlertsSummary {
  services: ServiceBedAlert[];
  /** Sum of each row's freeBeds — must equal the header. */
  totalFreeBeds: number;
  /** Occupied/total for the three metro services only; null when they have no beds. */
  metroOccupancyPercent: number | null;
  /** Remaining capacity percent for the three metro services only; null when they have no beds. */
  metroRemainingCapacityPercent?: number | null;
  mostPressing: ServiceBedAlert | null;
  /** Metro-wide ED pressure summary. */
  metroEdSummary?: ServiceEdSummary;
}

/**
 * Occupancy colour band applied the same way to every service.
 * Labels are the occupancy figure, not invented clinical codes.
 */
export function occupancyTone(occupancyPercent: number): {
  code: ServiceBedAlertCode;
  codeLabel: string;
} {
  const codeLabel = `${occupancyPercent}%`;
  if (occupancyPercent >= OCCUPANCY_CRITICAL_PERCENT) return { code: "red", codeLabel };
  if (occupancyPercent >= OCCUPANCY_ALERT_PERCENT) return { code: "yellow", codeLabel };
  return { code: "green", codeLabel };
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Group live wards by the health service already stored on each site.
 * Free beds use `openBedsNow` (same as the rest of the app). Occupied = total − free (≥ 0).
 * Optionally accepts `movements` and `now` to track ED capacity warnings and hospital codes.
 */
export function deriveServiceBedAlerts(
  units: readonly Unit[],
  bedReleases: readonly BedRelease[],
  sites: readonly Site[] = wardSites,
  movements: readonly Movement[] = [],
  now: Instant = 0,
  /** The configured ED access target; the rail passes `state.configuration.edAccessTargetMinutes`. */
  accessTargetMinutes?: number,
): ServiceBedAlertsSummary {
  // Leverage the comprehensive backend tracker
  const report = trackServiceBedCapacity(units, bedReleases, movements, now, sites, accessTargetMinutes);

  const codePriority: Record<ServiceBedAlertCode, number> = {
    black: 4,
    red: 3,
    yellow: 2,
    green: 1,
  };

  const services: ServiceBedAlert[] = [];
  for (const s of report.services) {
    const occTone = occupancyTone(s.occupancyPercent);
    const effectiveCode: ServiceBedAlertCode =
      (codePriority[s.compoundEscalation?.level ?? "green"] ?? 0) > (codePriority[occTone.code] ?? 0)
        ? (s.compoundEscalation?.level as ServiceBedAlertCode)
        : occTone.code;

    services.push({
      id: s.id,
      name: s.service,
      shortName: s.service,
      facilities: s.facilitiesList,
      code: effectiveCode,
      codeLabel: occTone.codeLabel,
      occupancyPercent: s.occupancyPercent,
      occupiedBeds: s.occupiedBeds,
      totalBeds: s.totalBeds,
      freeBeds: s.remainingBeds,
      escalation: `${s.remainingBeds} free · ${s.occupiedBeds} occupied`,
      hospitalCodes: s.hospitalCodes,
      remainingCapacityPercent: s.remainingCapacityPercent,
      hospitals: s.hospitals,
      edSummary: s.edSummary,
      compoundEscalation: s.compoundEscalation,
    });
  }

  const totalFreeBeds = services.reduce((sum, row) => sum + row.freeBeds, 0);

  let metroOccupied = 0;
  let metroTotal = 0;
  let metroFree = 0;
  for (const row of services) {
    if (!(METRO_HEALTH_SERVICES as readonly string[]).includes(row.shortName)) continue;
    metroOccupied += row.occupiedBeds;
    metroTotal += row.totalBeds;
    metroFree += row.freeBeds;
  }
  const metroOccupancyPercent = metroTotal > 0 ? roundOneDecimal((metroOccupied / metroTotal) * 100) : null;
  const metroRemainingCapacityPercent = metroTotal > 0 ? roundOneDecimal((metroFree / metroTotal) * 100) : null;

  const mostPressing = report.mostPressingService
    ? (services.find((s) => s.shortName === report.mostPressingService?.service) ?? null)
    : services.length === 0
      ? null
      : services.reduce((highest, current) => {
          if ((codePriority[current.code] ?? 0) > (codePriority[highest.code] ?? 0)) return current;
          if ((codePriority[current.code] ?? 0) < (codePriority[highest.code] ?? 0)) return highest;
          if (current.occupancyPercent > highest.occupancyPercent) return current;
          return highest;
        });

  return {
    services,
    totalFreeBeds,
    metroOccupancyPercent,
    metroRemainingCapacityPercent,
    mostPressing,
    metroEdSummary: report.metroEdSummary,
  };
}
