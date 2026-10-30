"use client";

import { useMemo, type ReactNode } from "react";

import {
  useWardFlow,
  WardFlowOverride,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";

import styles from "./pop-state-empty.module.css";

const NONE: never[] = [];

/**
 * The Empty mock-up: Home when nothing needs a person (Josh, 30 Oct 2026: keep the hero band and the
 * ED strip with their real zeros above the empty list, so the empty list reads as genuine).
 *
 * The page is today's Home redesign, drawn over a quiet copy of the synthetic world: the wards, their
 * beds and the people already admitted stay as seeded, and every patient journey, referral, bed
 * release, booking, notification, refusal and notice is taken away. Every figure on the page (the
 * band, the ED strip, the counts, Beds that fit and the lists' own empty lines) is then worked out
 * from that world by the page's own derivations, so nothing is typed in. Only the page reads the
 * quiet world: the rail and header around it still read the seeded one.
 */
export function PopStateEmpty({ page }: { page: ReactNode }) {
  const world = useWardFlow();
  const quiet = useMemo<WardFlowContextValue>(
    () => ({
      ...world,
      movements: NONE,
      referrals: NONE,
      wardReferralInbox: () => NONE,
      rejections: NONE,
      bedReleases: NONE,
      refreshRequests: NONE,
      repatriations: NONE,
      notices: NONE,
      broadcastAlerts: NONE,
      plannedAdmissions: NONE,
      supportNotifications: NONE,
      homeServiceReturns: NONE,
      directoryChecks: NONE,
      focusMovementId: undefined,
    }),
    [world],
  );
  return (
    <WardFlowOverride value={quiet}>
      <div className={styles.wrap} data-testid="pop-state-empty">
        {page}
      </div>
    </WardFlowOverride>
  );
}
