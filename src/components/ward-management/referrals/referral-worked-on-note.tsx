"use client";

import { useMemo } from "react";

import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";

import { referralWorkedOnBy, workedOnLine } from "./referral-worked-on";
import styles from "./referral-worked-on.module.css";

/**
 * The "Being worked on by" note under a waiting referral's decision clock (smart features idea 3).
 * A courtesy note, not a lock: it never disables anything. Outside a provider it shows nothing.
 */
export function ReferralWorkedOn({ referral }: { referral: Referral }) {
  const flow = useOptionalWardFlowSelect(
    "movements",
    "inboxOwnership",
    "units",
    "configuration",
    "inboxSnoozes",
    "admissions",
    "patients",
    "referrals",
    "supportNotifications",
    "plannedAdmissions",
    "leaveBeds",
  );
  const now = useWardFlowClock(0);
  // The task rows on the list now, so a claim on a row that has since cleared names nobody. The
  // same `taskItems` call as the header badge (shared last answer), keyed on the records it reads.
  const movements = flow?.movements;
  const inboxOwnership = flow?.inboxOwnership;
  const units = flow?.units;
  const configuration = flow?.configuration;
  const inboxSnoozes = flow?.inboxSnoozes;
  const admissions = flow?.admissions;
  const patients = flow?.patients;
  const referrals = flow?.referrals;
  const supportNotifications = flow?.supportNotifications;
  const plannedAdmissions = flow?.plannedAdmissions;
  const leaveBeds = flow?.leaveBeds;
  const line = useMemo(() => {
    if (!movements || !inboxOwnership || !units || !configuration || !inboxSnoozes) return undefined;
    const liveRowIds = new Set(
      taskItems(
        {
          movements,
          units,
          configuration,
          inboxSnoozes,
          admissions,
          patients,
          referrals,
          supportNotifications,
          plannedAdmissions,
          leaveBeds,
          stuckHandoverMinutes: configuration.transportBookedTargetMinutes,
        },
        now,
      ).map((item) => item.id),
    );
    return workedOnLine(
      referralWorkedOnBy(referral, { movements, inboxOwnership, units, rowIsLive: (rowId) => liveRowIds.has(rowId) }),
    );
  }, [
    movements,
    inboxOwnership,
    units,
    configuration,
    inboxSnoozes,
    admissions,
    patients,
    referrals,
    supportNotifications,
    plannedAdmissions,
    leaveBeds,
    now,
    referral,
  ]);
  if (!line) return null;
  return (
    <p className={styles.note} data-testid={`ward-referral-worked-on-${referral.id}`}>
      {line}
    </p>
  );
}
