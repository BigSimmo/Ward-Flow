"use client";

import { useMemo } from "react";

import type { ReadyBedsLookup } from "@/components/ward-management/ward-eligibility";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { sharedReadyLookup } from "@/components/ward-management/ward-shared-ready";

/**
 * H7 (mechanics and clock audit; D-MCA (Josh, 14 Nov 2026)): the shared Ready for a fit list on
 * this desk, from the same records Capacity reads. `undefined` outside a provider (some screen
 * tests), where a fit check falls back to the ward's own two figures.
 */
export function useSharedReadyLookup(): ReadyBedsLookup | undefined {
  const flow = useOptionalWardFlowSelect("admissions", "bedReleases", "movements", "referrals");
  const admissions = flow?.admissions;
  const bedReleases = flow?.bedReleases;
  const movements = flow?.movements;
  const referrals = flow?.referrals;
  return useMemo(
    () =>
      admissions && bedReleases && movements && referrals
        ? sharedReadyLookup({ admissions, bedReleases, movements, referrals })
        : undefined,
    [admissions, bedReleases, movements, referrals],
  );
}
