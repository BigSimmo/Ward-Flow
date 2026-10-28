"use client";

import { useMemo } from "react";
import { useEffectiveWardAccess } from "./shell/ward-access-store";
import type { WardPartialView } from "./ward-partial-view-contract";
import { useWardPartialDisplay, useWardPartialDisplayHost } from "./ward-partial-view";

/** Lookup only in the validated current display. An absent required summary means unavailable;
 * a receiving row uses its already-scoped record. Grant-only destination progress stays
 * unavailable. Neither result grants a command. */
export function senderPresentationLookup(view: WardPartialView | null, required: boolean) {
  const referrals = new Map(view?.referrals.map((row) => [row.id, row]));
  const movements = new Map(view?.movements.map((row) => [row.id, row]));
  return {
    required,
    referralFor(referral: { readonly id: string }) {
      if (!required) return undefined;
      const row = referrals.get(referral.id);
      return row?.kind === "sender" ? row : row?.kind === "restricted" ? undefined : null;
    },
    movementFor(movement: { readonly id: string }) {
      if (!required) return undefined;
      const row = movements.get(movement.id);
      return row?.kind === "sender"
        ? row
        : row?.kind === "restricted" && row.restriction === "receiving"
          ? undefined
          : null;
    },
  };
}

export function useSenderPresentation() {
  const view = useWardPartialDisplay();
  const host = useWardPartialDisplayHost();
  const effective = useEffectiveWardAccess();
  // The genuine shared role wins while the role store catches up. Coordinator previews instead
  // use the effective preview role and its separate locally projected display.
  const actualRole = host.readSource?.access.role;
  const role = actualRole && actualRole !== "coordinator" ? actualRole : effective.role;
  const required = host.senderRequired || role === "ward" || role === "bed_manager";
  return useMemo(() => senderPresentationLookup(view, required), [view, required]);
}
