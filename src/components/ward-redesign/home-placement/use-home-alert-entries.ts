"use client";

/**
 * Mock-up only (D-91, Home placement drawer, H7 to H10, 3 Nov 2026). Home's "My list" rows, built
 * exactly as `coordinator/coordinator-screen.tsx` builds them, so the placement drawer mock-up opens
 * for the same alert the real list shows. On approval this becomes the shared hook both read.
 */
import { useMemo } from "react";

import {
  admissionIdOfInboxId,
  alertActionFor,
  alertGroupOf,
  alertKindOf,
  byOldest,
  effectiveOwner,
  isQueueItem,
  raisedAt,
  resolveAlertSubject,
} from "@/components/ward-management/alerts/alerts-model";
import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { currentInboxOwner } from "@/components/ward-management/ward-inbox-snooze";

const IN_PLACE_KINDS = new Set(["hold", "declines", "nobed", "unsuitable"]);

export function useHomeAlertEntries(now: Instant): QueueEntry[] {
  const {
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
    inboxAcknowledgements,
    inboxOwnership,
  } = useWardFlowSelect(
    "movements",
    "units",
    "configuration",
    "inboxSnoozes",
    "admissions",
    "patients",
    "referrals",
    "supportNotifications",
    "plannedAdmissions",
    "leaveBeds",
    "inboxAcknowledgements",
    "inboxOwnership",
  );
  return useMemo(() => {
    const coordinator = WARD_FLOW_ROLE_LABELS.coordinator;
    const lookup = { patients, referrals, movements };
    return activeTaskItems(
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
    )
      .map((item) =>
        !item.id.startsWith("bed-pull-") && item.title !== "Bed pull expired"
          ? item
          : {
              ...item,
              title: "Pull expired, bed still pulled",
              detail: `${item.detail} · Release the bed or set a new pull time limit`,
            },
      )
      .filter(isQueueItem)
      .map((item: InboxItem): QueueEntry => {
        const movement = movements.find((candidate) => candidate.id === item.movementId);
        const booking = item.plannedAdmission
          ? { planned: item.plannedAdmission, personLabel: item.personLabel }
          : undefined;
        const stayId = admissionIdOfInboxId(item.id);
        const admission = stayId !== undefined ? admissions.find((stay) => stay.id === stayId) : undefined;
        const subject = resolveAlertSubject(
          movement,
          item.movementId,
          lookup,
          units,
          booking,
          admission,
          item.personId,
        );
        const owner = effectiveOwner(item, inboxOwnership[item.id]);
        return {
          item,
          movement,
          subject,
          group: alertGroupOf(item),
          owner,
          mine: owner === coordinator,
          raised: raisedAt(item, movement),
          seen: inboxAcknowledgements[item.id]?.at(-1),
          ownedSince: currentInboxOwner(inboxOwnership[item.id], item.since)?.at,
          snooze: undefined,
          action: IN_PLACE_KINDS.has(alertKindOf(item.id) ?? "")
            ? { kind: "release" as const, label: alertKindOf(item.id) === "hold" ? "Release pulled bed" : "Find a bed" }
            : alertActionFor(item, subject),
          highlighted: false,
        };
      })
      .sort((a, b) => byOldest({ at: a.raised }, { at: b.raised }));
  }, [
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
    inboxAcknowledgements,
    inboxOwnership,
    now,
  ]);
}
