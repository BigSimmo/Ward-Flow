"use client";

import { useMemo } from "react";

import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import { plannedRows, type PlannedRow } from "./planned-model";

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
  const endOfDay = (dayOf(now) + 1) * MINUTES_PER_DAY;
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
        nameOf,
      }),
    [movements, admissions, plannedAdmissions, units, configuration, now, until, endOfDay, nameOf],
  );
}
