import type { Admission } from "@/components/ward-management/ward-admissions";
import { capacityBreakdown, bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { bedStates, type BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { Instant } from "@/components/ward-management/ward-clock";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import type { BedRelease, HealthService, LeaveBed, Unit } from "@/components/ward-management/ward-model";
import type { EdPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService } from "@/components/ward-management/ward-service-scope";
import { siteByCode } from "@/components/ward-management/ward-sites";

/**
 * The Network overview's figures (v6 Network mockup). Every count is read from the same helpers the
 * capacity board and the ward screen use — `bedStates` for Ready, Pulled, Closed and Occupied and
 * `capacityBreakdown` for Expected today — so this screen cannot disagree with them. Nothing here
 * invents a figure: a service with no ED or no ward simply has none.
 */

export type NetworkUnitRow = {
  unit: Unit;
  service: HealthService | undefined;
  states: BedStateCounts;
  /** Beds expected to free today (`capacityBreakdown().expectedToday`). */
  expected: number;
  /** Ready beds still being made ready. A qualifier beside Ready, never subtracted from it. */
  pendingPreparation: number;
};

export function networkUnitRows(input: {
  units: readonly Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  now: Instant;
}): NetworkUnitRow[] {
  return input.units.map((unit) => ({
    unit,
    service: siteByCode(unit.siteCode)?.service,
    states: bedStates(unit, input.admissions, input.bedReleases, input.leaveBeds),
    expected: capacityBreakdown(unit, input.bedReleases, input.leaveBeds, input.now).expectedToday,
    pendingPreparation: bedsPendingPreparation(unit.id, input.bedReleases),
  }));
}

/** People waiting in each service's emergency departments. */
export function waitingByService(pressure: readonly EdPressure[]): Map<HealthService, number> {
  const totals = new Map<HealthService, number>();
  for (const row of pressure) {
    const service = edHealthService(row.ed.id);
    if (service === undefined) continue;
    totals.set(service, (totals.get(service) ?? 0) + row.waiting);
  }
  return totals;
}

export type ServiceGroup = {
  service: HealthService;
  rows: NetworkUnitRow[];
  ready: number;
  pulled: number;
  occupied: number;
  beds: number;
  /** People waiting in this service's EDs. */
  waiting: number;
};

/** Units grouped by health service in the canonical service order. Services with no ward are dropped. */
export function serviceGroups(rows: readonly NetworkUnitRow[], waiting: Map<HealthService, number>): ServiceGroup[] {
  return wardServiceOrder
    .map((service) => {
      const inService = rows.filter((row) => row.service === service);
      return {
        service,
        rows: inService,
        ready: inService.reduce((sum, row) => sum + row.states.ready, 0),
        pulled: inService.reduce((sum, row) => sum + row.states.pulled, 0),
        occupied: inService.reduce((sum, row) => sum + row.states.occupied, 0),
        beds: inService.reduce((sum, row) => sum + row.unit.beds, 0),
        waiting: waiting.get(service) ?? 0,
      };
    })
    .filter((group) => group.rows.length > 0);
}

/** Ready beds minus people waiting in the service's EDs. Negative is a shortfall. */
export function readyGap(group: Pick<ServiceGroup, "ready" | "waiting">): number {
  return group.ready - group.waiting;
}

/** The service with the largest shortfall, or undefined when ready beds cover every service's wait. */
export function largestShortfall(groups: readonly ServiceGroup[]): ServiceGroup | undefined {
  let worst: ServiceGroup | undefined;
  for (const group of groups) {
    if (readyGap(group) >= 0) continue;
    if (worst === undefined || readyGap(group) < readyGap(worst)) worst = group;
  }
  return worst;
}

/** Occupied share, one decimal place, or undefined for no beds. */
export function occupiedPercent(occupied: number, beds: number): string | undefined {
  if (beds <= 0) return undefined;
  return `${((occupied / beds) * 100).toFixed(1)}%`;
}
