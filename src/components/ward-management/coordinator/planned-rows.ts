"use client";

import { useMemo } from "react";

import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import { plannedRows, tomorrowOutlook, type PlannedRow, type TomorrowOutlook } from "./planned-model";

/** The rest of the shift's planned rows, read once by Home for the tab count and the list. */
export function usePlannedRows(now: Instant): readonly PlannedRow[] {
  const { movements, admissions, plannedAdmissions, units, configuration } = useWardFlowSelect(
    "movements",
    "admissions",
    "plannedAdmissions",
    "units",
    "configuration",
  );
  const nameOf = usePatientOf();
  const until = shiftEndInstant(now);
  const startOfDay = dayOf(now) * MINUTES_PER_DAY;
  const endOfDay = startOfDay + MINUTES_PER_DAY;
  return useMemo(
    () =>
      plannedRows({
        movements,
        admissions,
        plannedAdmissions: plannedAdmissions ?? [],
        units,
        configuration,
        now,
        until,
        endOfDay,
        startOfDay,
        nameOf,
      }),
    [movements, admissions, plannedAdmissions, units, configuration, now, until, endOfDay, startOfDay, nameOf],
  );
}

/** Tomorrow's recorded expected discharges and planned admissions, for the foot of Later today. */
export function useTomorrowOutlook(now: Instant): TomorrowOutlook {
  const { admissions, plannedAdmissions, units } = useWardFlowSelect("admissions", "plannedAdmissions", "units");
  const nameOf = usePatientOf();
  const endOfDay = (dayOf(now) + 1) * MINUTES_PER_DAY;
  return useMemo(
    () => tomorrowOutlook({ admissions, plannedAdmissions: plannedAdmissions ?? [], units, nameOf, endOfDay }),
    [admissions, plannedAdmissions, units, nameOf, endOfDay],
  );
}
