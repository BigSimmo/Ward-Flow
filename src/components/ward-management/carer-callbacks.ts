"use client";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";

import { handoverDeskOf } from "@/components/ward-management/handover/handover-desk";
import type { CarerCallbackRecord } from "./handover-work-events";
import { carerCallbacksDue } from "./handover-work-model";

const NONE: CarerCallbackRecord[] = [];

/**
 * Item 23: the carer callbacks due for this desk on the handover page, earliest first. The ward
 * desk sees its own ward's and the coordinator every one; no other desk owes a carer call back. The
 * handover hero's promises count and the promises card read this one list, so they never disagree.
 */
export function useCarerCallbacksDue(now: Instant): CarerCallbackRecord[] {
  const flow = useOptionalWardFlowSelect("carerCallbacks", "units");
  const routeRole = useRouteRole();
  const access = useEffectiveWardAccess();
  if (!flow || (routeRole !== "coordinator" && routeRole !== "ward")) return NONE;
  const due = carerCallbacksDue({ carerCallbacks: flow.carerCallbacks ?? NONE }, now);
  if (routeRole === "coordinator") return due;
  const ownWard = handoverDeskOf(access, flow.units).ownWard;
  return ownWard ? due.filter((record) => record.unitId === ownWard.id) : NONE;
}
