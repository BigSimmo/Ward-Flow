"use client";

import { useCallback, useEffect } from "react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";

import { downtimePack, lastDowntimeSyncAt, noteDowntimeSync, rememberDowntimePack } from "./downtime-pack";
import { useDowntimePackAccess } from "./downtime-pack-context";
import { useOwnUnits } from "./use-own-units";

/**
 * Takes a downtime pack of the desk's current scope and remembers it in this tab's memory (D-18).
 * Shared by the downtime screen ("New snapshot", first opening) and the shell's hourly and shift
 * change schedule, so both build the same pack from the same records. Offline, the pack is marked
 * "taken offline" with the last sync time, and never replaces one taken online (owner, 22 Oct 2026).
 */
export function useTakeDowntimePack(): (options?: { shiftChangeAt?: Instant | null }) => void {
  const now = useWardFlowClock();
  const { units, admissions, bedReleases, leaveBeds, movements, worldGeneration, shared } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "leaveBeds",
    "movements",
    "worldGeneration",
    "shared",
  );
  // Beds of the desk's own wards only (issue #628): another ward's stays are not in this desk's
  // records. Every ward still names a destination.
  const bedUnits = useOwnUnits(units);
  const patientOf = usePatientOf();
  const { owner, ready } = useDowntimePackAccess();
  const online = useOnlineStatus();
  const canTake = !shared?.enabled || shared.status === "ready";
  useEffect(() => {
    if (online && canTake) noteDowntimeSync(now, worldGeneration);
  }, [online, canTake, now, worldGeneration]);
  return useCallback(
    (options?: { shiftChangeAt?: Instant | null }): void => {
      if (!ready || !canTake) return;
      const pack = downtimePack({
        units,
        bedUnits,
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
      if (!online) pack.offline = { lastSyncAt: lastDowntimeSyncAt(worldGeneration, now) };
      const shiftChangeAt = options?.shiftChangeAt;
      rememberDowntimePack(
        typeof shiftChangeAt === "number" ? { ...pack, shiftChangeAt } : pack,
        worldGeneration,
        owner,
      );
    },
    [
      units,
      bedUnits,
      admissions,
      bedReleases,
      leaveBeds,
      movements,
      now,
      patientOf,
      worldGeneration,
      owner,
      ready,
      online,
      canTake,
    ],
  );
}
