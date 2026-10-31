"use client";

import { useCallback, useEffect, useRef } from "react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";
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
  // Audit F-05: in shared mode "last sync" is the last successful workspace read, not every clock
  // tick while the browser says online. A dropped server with the browser still online, or a read
  // that has not come back yet, leaves it where it was. Without a shared workspace there is no
  // server to sync with, so the local board is in sync whenever the browser is online, as before.
  const receivedAt = shared?.enabled ? (shared.receivedAt ?? 0) : null;
  const notedRead = useRef<string | null>(null);
  useEffect(() => {
    if (!online || !canTake) return;
    if (receivedAt === null) {
      noteDowntimeSync(now, worldGeneration);
      return;
    }
    const read = `${receivedAt}:${worldGeneration}`;
    if (receivedAt > 0 && notedRead.current !== read) {
      notedRead.current = read;
      noteDowntimeSync(now, worldGeneration);
    }
  }, [online, canTake, now, worldGeneration, receivedAt]);
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
        // Surname first (D-83): "Family, Given · UMRN", the one identity line (bug list row 17).
        identify: (movement) => patientIdentityLine(patientOf(movement)),
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
