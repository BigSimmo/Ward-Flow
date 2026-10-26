// The Alerts screen's Checking strip: every condition the screen looks at, by name, with its count.
// Moved out of `alerts-screen.tsx` to keep it under the line cap.
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

import { alertKindOf, type AlertKind } from "./alerts-model";

export function alertChecks({
  allInbox,
  openMovements,
  referrals,
  movements,
  now,
}: {
  allInbox: readonly InboxItem[];
  openMovements: readonly Movement[];
  referrals: readonly Referral[] | undefined;
  movements: readonly Movement[];
  now: Instant;
}) {
  const countKind = (kind: AlertKind) => allInbox.filter((item) => alertKindOf(item.id) === kind).length;
  const withDeadline = openMovements.filter((movement: Movement) => movement.legalForm?.dueAt !== undefined);
  const declineCandidates = openMovements.filter((movement: Movement) => movement.declines.length > 0).length;
  const untriaged = (referrals ?? []).filter((referral) => referral.triagedAt === undefined);
  const prolongedEdCount = openMovements.filter(
    (movement: Movement) => movement.originEdId !== undefined && now - movement.openedAt >= LONG_WAIT_MINUTES,
  ).length;
  const overrideCount = movements.reduce((total, movement: Movement) => total + movement.overrides.length, 0);
  const checks: { key: string; kind?: AlertKind; label: string; n: number; href?: string; scope: string }[] = [
    {
      key: "legal",
      kind: "legal",
      label: "Legal due time passed",
      n: countKind("legal"),
      scope: `Watches every movement carrying a recorded form expiry. ${countKind("legal")} of ${withDeadline.length} with a written deadline passed.`,
    },
    {
      key: "declines",
      kind: "declines",
      label: "Every ward declined",
      n: countKind("declines"),
      scope: `Watches movements where every ward approached has refused and none has accepted. ${countKind("declines")} of ${declineCandidates} declined by every ward asked.`,
    },
    {
      key: "unsuitable",
      kind: "unsuitable",
      label: "Unsuitable destination",
      n: countKind("unsuitable"),
      scope:
        "Watches accepted destinations against an authorised-hospital check for the patient's current recorded status.",
    },
    {
      key: "nobed",
      kind: "nobed",
      label: "No eligible bed",
      n: countKind("nobed"),
      scope:
        "Watches open movements still waiting for a ward where no ward in the network is currently eligible. The patient stays on the waiting list and this is shown to the bed coordinator.",
    },
    {
      key: "hold",
      kind: "hold",
      label: "Pull expired",
      n: countKind("hold"),
      scope: "Watches pulled beds against their pull time limit.",
    },
    {
      key: "transport",
      kind: "transport",
      label: "Transport not left",
      n: countKind("transport"),
      scope: "Watches accepted transport legs that have not departed.",
    },
    {
      key: "planned",
      kind: "planned",
      label: "Planned arrival late",
      n: countKind("planned"),
      scope: "Watches booked planned admissions whose expected arrival time has passed with no arrival recorded.",
    },
    {
      key: "notify",
      kind: "notify",
      label: "Notifications to record",
      n: countKind("notify"),
      scope:
        "Watches recent arrivals, transfers and discharges where a carer, personal support person or advocacy service notification is not recorded.",
    },
    {
      key: "target",
      kind: "target",
      label: "Target overdue",
      n: countKind("target"),
      scope:
        "Watches referral decisions, transfer acceptances and transport bookings against their targets, defaults set in Settings.",
    },
    {
      key: "triage",
      label: "Triage waiting",
      n: untriaged.length,
      href: "/ward-flow/referrals",
      scope: `Watches referrals that have never been triaged. ${untriaged.length} of ${(referrals ?? []).length} referrals have never been triaged. Opens Referrals.`,
    },
    {
      key: "ed",
      label: "ED over a day",
      n: prolongedEdCount,
      href: "/ward-flow/waiting",
      scope: "Watches open ED waits of a day or more. Opens Waiting.",
    },
    {
      key: "override",
      label: "Override recorded",
      n: overrideCount,
      scope:
        "Watches referrals made by override. This screen cannot identify a prior gate verdict. The record keeps who, when, which fixed reason and which wards. It does not retain a prior gate verdict.",
    },
  ];
  return checks;
}
