"use client";

import { useMemo } from "react";

import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { bedStates, networkNamedHolds } from "@/components/ward-management/ward-bed-states";
import type { DueSoonThresholds } from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import type { LeaveBed, Unit } from "@/components/ward-management/ward-model";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { admittedLegalExpiryPassed } from "@/components/ward-management/ward-legal-admitted";
import { LEAVE_BED_OPEN_WARNING_MINUTES } from "@/components/ward-management/ward-operational-defaults";

import { wardBedRoster, wardLiveFormAlerts } from "./ward-screen-derivations";

type RosterInputs = Parameters<typeof wardBedRoster>[0];

/**
 * The ward screen's heavy derivations (bed states, occupancy, capacity, the bed roster and live
 * form alerts), each memoised on its own inputs. The screen is
 * skipped by the React Compiler, so without this every keystroke in its Find box or a sheet opening
 * re-derived all of them. Pure: the same inputs give the same figures as calling each directly.
 * `null` while the ward is not found, so the hook runs before the screen's not-found return.
 */
export function useWardScreenFigures(
  inputs: Omit<RosterInputs, "unit" | "states"> & {
    unit: Unit | undefined;
    leaveBeds: LeaveBed[];
    thresholds: DueSoonThresholds;
  },
) {
  const { unit, admissions, bedReleases, leaveBeds, now, unitLeaveBeds, accepted, movements } = inputs;
  const { resolvePatientIdentity, thresholds, criteriaLedOn, patients, plannedAdmissions, dayZero } = inputs;
  const { wardReferralInbox } = inputs;
  const steady = useMemo(
    () =>
      unit && {
        capacity: unitCapacity(unit, bedReleases),
        // A16-25 (3.4): the ward's named holds, as its board counts them, so Ready matches Capacity.
        // A9-13 (Audit 9): a bed pulled on the board for an accepted referral now lowers the hero too.
        states: bedStates(
          unit,
          admissions,
          bedReleases,
          leaveBeds,
          networkNamedHolds(movements, wardReferralInbox?.(unit.id) ?? []),
        ),
        occupancy: wardOccupancy([unit], admissions, bedReleases),
      },
    [unit, admissions, bedReleases, leaveBeds, movements, wardReferralInbox],
  );
  const breakdown = useMemo(
    () => unit && capacityBreakdown(unit, bedReleases, leaveBeds, now),
    [unit, bedReleases, leaveBeds, now],
  );
  const overdueLeaveBeds = useMemo(
    () => unitLeaveBeds.filter((leaveBed) => now - leaveBed.confirmedAt >= LEAVE_BED_OPEN_WARNING_MINUTES),
    [unitLeaveBeds, now],
  );
  const liveFormAlerts = useMemo(
    () =>
      unit &&
      wardLiveFormAlerts({
        resolvePatientIdentity,
        accepted,
        now,
        thresholds,
        overdueLeaveBeds,
        unit,
        dayZero,
        // Audit M1, D-MCA (Josh, 14 Nov 2026) ruling 2: this ward's admitted people on a form.
        admittedLegalPassed: admittedLegalExpiryPassed(movements, admissions, now).filter(
          (movement) => movement.acceptedUnitId === unit.id,
        ),
      }).liveFormAlerts,
    [resolvePatientIdentity, accepted, now, thresholds, overdueLeaveBeds, unit, dayZero, movements, admissions],
  );
  const states = steady?.states;
  const roster = useMemo(
    () =>
      unit &&
      states &&
      wardBedRoster({
        unit,
        unitLeaveBeds,
        admissions,
        bedReleases,
        states,
        accepted,
        movements,
        resolvePatientIdentity,
        now,
        criteriaLedOn,
        patients,
        plannedAdmissions,
        dayZero,
        wardReferralInbox,
      }),
    [
      unit,
      unitLeaveBeds,
      admissions,
      bedReleases,
      states,
      accepted,
      movements,
      resolvePatientIdentity,
      now,
      criteriaLedOn,
      patients,
      plannedAdmissions,
      dayZero,
      wardReferralInbox,
    ],
  );
  if (!steady || !breakdown || !liveFormAlerts || !roster) return null;
  return { ...steady, breakdown, liveFormAlerts, roster };
}
