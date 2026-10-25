"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, type ComponentProps } from "react";

import type { Instant } from "../ward-clock";
import { useWardRaise } from "../ward-flow-raise";
import type { Referral } from "../ward-model";
import { useRouteRole } from "../ward-role-gate";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { openInformationNeeds } from "./referral-information-needs";
import type { WardReferralInboxEntry } from "./referral-inbox";

/**
 * Smart features ideas 3 and 4 (19 Oct 2026): the referral screens import the "what we still need"
 * panels from here. Their code loads only when a switch is on or a ward has actually asked for
 * something, so the referrals and movement pages stay within their phone script budgets.
 */
const panelPending = () => null;

const LazyPicker = dynamic(
  () => import("./referral-information-needs-panel").then((m) => m.WardInformationNeedsPicker),
  {
    loading: panelPending,
  },
);
const LazyTickOff = dynamic(
  () => import("./referral-information-needs-panel").then((m) => m.ReferralInformationNeedsPanel),
  { loading: panelPending },
);

/** The ward's "what we still need" picker, behind the `referral-information-needs` switch. */
export function WardInformationNeedsPicker(props: ComponentProps<typeof LazyPicker>) {
  const enabled = useWardFeatureFlag("referral-information-needs");
  return enabled ? <LazyPicker {...props} /> : null;
}

/** The referrer's list to tick off. Nothing asked: nothing loads. */
export function ReferralInformationNeedsPanel({ referral, now }: { referral: Referral; now: Instant }) {
  const asked = referral.destinations.some((arm) => openInformationNeeds(arm.informationNeeds).length > 0);
  return asked ? <LazyTickOff referral={referral} now={now} /> : null;
}

/**
 * Stamps "opened" on each of this ward's live referrals the first time the ward itself shows them.
 * Only for a ward acting as itself; the coordinator looking at a ward's inbox is not the ward.
 */
export function useMarkReferralsOpened(
  entries: readonly WardReferralInboxEntry[],
  unitId: string,
  actingUnitId: string | undefined,
) {
  const enabled = useWardFeatureFlag("referral-opened-receipts");
  const raise = useWardRaise("ward");
  const routeRole = useRouteRole();
  const unopened = entries
    .filter((entry) => entry.state === "queued" && entry.withdrawnAt === undefined && entry.openedAt === undefined)
    .map((entry) => entry.id)
    .join(" ");
  // Production audit URE-07: a receipt already sent from this mount is not sent again while it is
  // in flight; a new referral arriving re-runs the effect, and the duplicate would be refused.
  const raised = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled || routeRole !== "ward" || actingUnitId !== unitId || unopened === "") return;
    for (const referralId of unopened.split(" ")) {
      const key = `${unitId} ${referralId}`;
      if (raised.current.has(key)) continue;
      raised.current.add(key);
      const forget = () => raised.current.delete(key);
      let result: ReturnType<typeof raise>;
      try {
        result = raise("MARK_REFERRAL_OPENED", { referralId, unitId, actingUnitId });
      } catch {
        forget();
        continue;
      }
      // Only an accepted receipt stays remembered; any other answer lets a later render try again.
      void Promise.resolve(result).then((outcome) => {
        if (outcome && outcome.status !== "accepted") forget();
      }, forget);
    }
    // `raise` carries the time a referral first appears; a clock tick alone does not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, routeRole, actingUnitId, unitId, unopened]);
}
