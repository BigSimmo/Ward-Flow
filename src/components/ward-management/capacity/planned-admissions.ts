// src/components/ward-management/capacity/planned-admissions.ts
//
// The planned admissions calendar's derivations (stream D, 9 October 2026). Pure functions: the
// fourteen-day count per day per health service, and the agenda of bookings still waiting.
import {
  PLANNED_ADMISSION_WINDOW_DAYS,
  plannedAdmissionIsOverdue,
  type PlannedAdmission,
} from "@/components/ward-management/ward-admissions";
import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import { HEALTH_SERVICES, type HealthService, type Unit } from "@/components/ward-management/ward-model";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";

export type PlannedAdmissionDay = {
  /** Days from today: 0 is today. */
  dayOffset: number;
  /** The absolute day number (`dayOf`) this row covers. */
  day: number;
  total: number;
  /** Non-zero services only, in `HEALTH_SERVICES` order. */
  byService: { service: HealthService; count: number }[];
};

/**
 * Booked planned admissions per day for the next `windowDays` days, today first, counted per
 * health service. Overdue bookings from an earlier day are not in any row; the agenda lists them.
 */
export function plannedAdmissionDays(
  planned: readonly PlannedAdmission[],
  units: readonly Unit[],
  now: Instant,
  windowDays: number = PLANNED_ADMISSION_WINDOW_DAYS,
): PlannedAdmissionDay[] {
  const today = dayOf(now);
  const unitLookup = new Map(units.map((unit) => [unit.id, unit]));
  const booked = planned.filter((booking) => booking.state === "booked");
  return Array.from({ length: windowDays }, (_, dayOffset) => {
    const day = today + dayOffset;
    const onDay = booked.filter((booking) => dayOf(booking.expectedArrivalAt) === day);
    const counts = new Map<HealthService, number>();
    for (const booking of onDay) {
      const unit = unitLookup.get(booking.unitId);
      const service = unit ? unitHealthService(unit) : undefined;
      if (service) counts.set(service, (counts.get(service) ?? 0) + 1);
    }
    return {
      dayOffset,
      day,
      total: onDay.length,
      byService: HEALTH_SERVICES.filter((service) => counts.has(service)).map((service) => ({
        service,
        count: counts.get(service) ?? 0,
      })),
    };
  });
}

/** Bookings still waiting for their person, soonest (and overdue) first. */
export function plannedAdmissionAgenda(planned: readonly PlannedAdmission[]): PlannedAdmission[] {
  return planned
    .filter((booking) => booking.state === "booked")
    .sort((a, b) => a.expectedArrivalAt - b.expectedArrivalAt || a.id.localeCompare(b.id));
}

/** How many booked planned admissions are past their expected arrival. */
export function overduePlannedAdmissionCount(planned: readonly PlannedAdmission[], now: Instant): number {
  return planned.filter((booking) => plannedAdmissionIsOverdue(booking, now)).length;
}
