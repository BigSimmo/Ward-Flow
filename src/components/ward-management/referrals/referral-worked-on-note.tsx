"use client";

import { useMemo } from "react";

import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";

import { referralWorkedOnBy, workedOnLine } from "./referral-worked-on";
import styles from "./referral-worked-on.module.css";

/**
 * The "Being worked on by" note under a waiting referral's decision clock (smart features idea 3).
 * A courtesy note, not a lock: it never disables anything. Outside a provider it shows nothing.
 */
export function ReferralWorkedOn({ referral }: { referral: Referral }) {
  const flow = useOptionalWardFlowSelect("movements", "inboxOwnership", "units");
  const movements = flow?.movements;
  const inboxOwnership = flow?.inboxOwnership;
  const units = flow?.units;
  const line = useMemo(
    () =>
      movements && inboxOwnership && units
        ? workedOnLine(referralWorkedOnBy(referral, { movements, inboxOwnership, units }))
        : undefined,
    [movements, inboxOwnership, units, referral],
  );
  if (!line) return null;
  return (
    <p className={styles.note} data-testid={`ward-referral-worked-on-${referral.id}`}>
      {line}
    </p>
  );
}
