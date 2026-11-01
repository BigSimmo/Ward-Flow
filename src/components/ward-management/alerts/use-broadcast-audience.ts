"use client";

// The composer's audience state (Alerts redesign, 1 Nov 2026), kept out of `alerts-screen.tsx` so
// the screen stays under its line cap. Pure reads live in `broadcast-audience.ts`.
import { useCallback, useMemo, useState } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import { readyBedsNow } from "@/components/ward-management/ward-bed-states";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

import {
  audienceGroups,
  audienceLabel,
  audienceRecipients,
  audienceScope,
  templateAudience,
  type BroadcastAudience,
} from "./broadcast-audience";
import { minutesText } from "./alerts-model";
import { broadcastKind, type BroadcastAlert, type BroadcastTargetScope } from "./ward-broadcast-model";
import type { LiveBedCall } from "./broadcast-composer";

export function useBroadcastAudience(
  state: Pick<WardFlowState, "units" | "admissions" | "bedReleases">,
  initial: { templateId: string; scope: BroadcastTargetScope },
  wardsOnly = false,
) {
  const { units, admissions, bedReleases } = state;
  const groups = useMemo(() => audienceGroups(units), [units]);
  // The wards Capacity shows with a bed ready now.
  const wardsWithBedNow = useMemo(
    () => units.filter((unit) => readyBedsNow(unit, admissions, bedReleases ?? []) > 0).map((unit) => unit.id),
    [units, admissions, bedReleases],
  );
  const [audience, setAudience] = useState<BroadcastAudience>(() =>
    templateAudience(initial.templateId, initial.scope, audienceGroups(units)),
  );
  const resetFor = useCallback(
    (templateId: string, scope: BroadcastTargetScope) => setAudience(templateAudience(templateId, scope, groups)),
    [groups],
  );
  const recipients = audienceRecipients(audience, groups, wardsWithBedNow, wardsOnly).map((desk) => desk.id);
  return {
    audience,
    setAudience,
    resetFor,
    groups,
    wardsWithBedNow,
    recipients,
    /** What the send stores: the scope it still maps to, its label and, unless Everyone, the desks. */
    target: {
      targetScope: audienceScope(audience),
      targetScopeLabel: audienceLabel(audience, groups),
      ...(audience.mode === "all" ? {} : { targetUnitIds: recipients }),
    },
  };
}

/** A live bed call that already asks some of the same wards, so the composer offers to extend it. */
export function liveBedCallFor(
  active: BroadcastAlert | undefined,
  recipients: readonly string[],
  now: Instant,
): LiveBedCall | undefined {
  if (!active || broadcastKind(active) !== "bed_call") return undefined;
  if (!(active.targetUnitIds ?? []).some((id) => recipients.includes(id))) return undefined;
  return {
    id: active.id,
    label: active.targetScopeLabel,
    minutesLeft: minutesText(Math.max(0, active.expiresAt - now)),
  };
}
