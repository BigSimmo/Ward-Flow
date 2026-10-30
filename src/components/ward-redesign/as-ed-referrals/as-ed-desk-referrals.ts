"use client";

// New for the role view (as ED clinician): what an ED desk's Referrals page says about its own journeys.
import { useMemo } from "react";

import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { durMinutes } from "@/components/wf";

import type { EdDeskHero } from "./as-ed-referral-board-phone";

/** The journeys this ED raised that are still open (no closure, no ED outcome), longest since referral first. */
function openRaisedFromEd(movements: readonly Movement[], edId: string | undefined): Movement[] {
  if (edId === undefined) return [];
  return movements
    .filter(
      (movement) => movement.originEdId === edId && movement.closure === undefined && movement.edOutcome === undefined,
    )
    .sort((a, b) => (a.referredAt ?? a.openedAt) - (b.referredAt ?? b.openedAt));
}

/**
 * Role view (as ED clinician): `edDesk` is true only on an ED desk. Its scoped copy holds only its
 * own department's journeys, so `raised` is what this ED asked for and is still open.
 */
export function useEdDeskReferrals(movements: readonly Movement[], now: Instant) {
  const access = useEffectiveWardAccess();
  const edDesk = access.role === "ed";
  const edId = edDesk && access.scope.kind === "ed" ? access.scope.edId : undefined;
  const departmentName = (edId === undefined ? undefined : edShortName(edById(edId))) || "this ED";
  const { configuration } = useWardFlowSelect("configuration");
  const raised = useMemo(() => (edDesk ? openRaisedFromEd(movements, edId) : []), [edDesk, movements, edId]);
  const oldest = raised[0];
  const oldestWait =
    oldest === undefined ? undefined : durMinutes(Math.max(now - (oldest.referredAt ?? oldest.openedAt), 0));
  // The configured pull hold, said as the ED board says it.
  const holdLabel =
    configuration.pullHoldMinutes % 60 === 0
      ? `${configuration.pullHoldMinutes / 60}h`
      : splitDuration(configuration.pullHoldMinutes);
  const phoneHero = (asked: number): EdDeskHero | undefined =>
    edDesk
      ? {
          department: departmentName,
          open: raised.length,
          oldest: oldestWait,
          noWardYet: raised.filter((movement) => movement.acceptedUnitId === undefined).length,
          accepted: raised.filter((movement) => movement.acceptedUnitId !== undefined).length,
          asked,
        }
      : undefined;
  return { edDesk, departmentName, raised, oldestWait, holdLabel, phoneHero };
}
