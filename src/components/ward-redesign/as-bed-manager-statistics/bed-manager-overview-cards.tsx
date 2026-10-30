"use client";

// Forked from NetworkOverviewCards in src/components/ward-management/statistics/statistics-network-cards.tsx.

import { useMemo } from "react";

import {
  AdmissionStagesCard,
  ServiceOccupancyCard,
  networkServiceRows,
  networkUnitRows,
} from "@/components/ward-management/statistics/statistics-network-cards";
import { FlushStack } from "@/components/ward-management/statistics/statistics-layout";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

/**
 * Role view (site bed manager, D-80): the Network cards for a site desk. Admission stages (its own
 * site's stays) comes first, beside its wards; Occupancy by health service keeps every site as bed
 * counts. Empty to ready is left out: it is the network's placement funnel, the coordinator's job.
 */
export function BedManagerOverviewCards({
  units,
  admissions,
  bedReleases,
  leaveBeds,
}: {
  units: Unit[];
  admissions: Admission[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
}) {
  const services = useMemo(
    () => networkServiceRows(networkUnitRows(units, admissions, bedReleases, leaveBeds)),
    [units, admissions, bedReleases, leaveBeds],
  );
  return (
    <FlushStack data-testid="ward-statistics-network-cards">
      <AdmissionStagesCard admissions={admissions} />
      <ServiceOccupancyCard services={services} />
    </FlushStack>
  );
}
