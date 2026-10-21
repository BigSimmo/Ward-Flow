"use client";

import { useCallback } from "react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import { downtimePack, rememberDowntimePack } from "./downtime-pack";
import { useDowntimePackAccess } from "./downtime-pack-context";

/**
 * Takes a downtime pack of the desk's current scope and remembers it in this tab's memory (D-18).
 * Shared by the downtime screen ("New snapshot", first opening) and the shell's hourly and shift
 * change schedule, so both build the same pack from the same records.
 */
export function useTakeDowntimePack(): () => void {
  const now = useWardFlowClock();
  const { units, admissions, bedReleases, leaveBeds, movements, worldGeneration } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "leaveBeds",
    "movements",
    "worldGeneration",
  );
  const patientOf = usePatientOf();
  const { owner, ready } = useDowntimePackAccess();
  return useCallback((): void => {
    if (!ready) return;
    const pack = downtimePack({
      units,
      admissions,
      bedReleases,
      leaveBeds,
      movements,
      now,
      identify: (movement) => {
        const person = patientOf(movement);
        return `${person.displayName} · ${person.umrn}`;
      },
    });
    rememberDowntimePack(pack, worldGeneration, owner);
  }, [units, admissions, bedReleases, leaveBeds, movements, now, patientOf, worldGeneration, owner, ready]);
}
