"use client";

import { clockZoneLabel, type ClockZoneLabel } from "./ward-clock";
import { useOptionalWardFlowSelect } from "./ward-flow-provider";

/**
 * RC 2.6 (F-113, D-190): the zone words for this board's clock. "AWST" on the signed-in shared
 * workspace, which runs on the real Perth clock; "demo time" in the local demo and outside a provider,
 * whose board clock is scripted. The mode test is the provider's own `shared.enabled`.
 */
export function useClockZoneLabel(): ClockZoneLabel {
  const picked = useOptionalWardFlowSelect("shared");
  return clockZoneLabel(picked?.shared?.enabled === true);
}
