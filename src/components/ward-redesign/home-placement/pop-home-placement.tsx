"use client";

/**
 * Mock-up only (D-91): the Home placement drawer (H7 to H10), drawn over the real Home for one
 * alert type. The viewer names the type in its pop-up slug; the alert is the first of that type in
 * the same My list the real Home shows.
 */
import { useState, type ReactNode } from "react";

import { alertKindOf, type AlertKind } from "@/components/ward-management/alerts/alerts-model";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";

import { PlacementDrawer, type PlacementSubject } from "./placement-drawer";
import { useHomeAlertEntries } from "./use-home-alert-entries";

export type HomePlacementPop = AlertKind | "referral";

export function PopHomePlacement({ page, kind }: { page: ReactNode; kind: HomePlacementPop }) {
  const now = useWardFlowClock();
  const entries = useHomeAlertEntries(now);
  const { referrals } = useWardFlowSelect("referrals");
  const [open, setOpen] = useState(true);
  let subject: PlacementSubject | undefined;
  if (kind === "referral") {
    const referral = referralQueueOrder(referrals)[0];
    subject = referral ? { kind: "referral", referral } : undefined;
  } else {
    const entry = entries.find((candidate) => alertKindOf(candidate.item.id) === kind);
    subject = entry ? { kind: "alert", entry } : undefined;
  }
  return (
    <>
      {page}
      {open && subject ? <PlacementDrawer subject={subject} now={now} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
