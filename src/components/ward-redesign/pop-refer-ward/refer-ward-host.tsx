"use client";

import { useRef, useState } from "react";

import { edBedSearchStep, openWardReferralFor } from "@/components/ward-management/ed/ed-bed-search-step";
import { edReferralSheetHref } from "@/components/ward-management/referrals/open-referral-sheet";
import { referralSheetRequestFromSearch } from "@/components/ward-management/referrals/referral-sheet-link";
import shell from "@/components/ward-management/shell/ward-bar.module.css";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { Sheet } from "@/components/wf/sheet";
import { ReferralDrawerRedesign } from "@/components/ward-redesign/new-referral/referral-drawer-redesign";

/** The emergency department the ED board mock-up draws. */
const ED_ID = "peel-ed";

/**
 * Refer to a ward, from an ED board row. In the app the row's button calls
 * `openReferralSheet(edReferralSheetHref(patientId, edId))` and the app bar opens the referral
 * slide-out with that request. Here the same link is read into the same request and the slide-out
 * opens in the app bar's own Sheet and classes, as the New referral mock-up does, using its
 * redesigned slide-out so the two read the same. It opens for the first person on the board whose
 * next step is Refer to a ward.
 */
export function ReferWardHost() {
  const { movements, referrals, resolvePatientIdentity } = useWardFlowSelect(
    "movements",
    "referrals",
    "resolvePatientIdentity",
  );
  const [open, setOpen] = useState(true);
  const closeRef = useRef<(() => void) | null>(null);
  const waiting = movements.filter((movement) => movement.originEdId === ED_ID && isWaitingInEd(movement));
  // The row's own rule (`ed/ed-screen-board-row.tsx`): an inpatient order, no outcome or closure,
  // not pulled, and no ward referral already open.
  const next = waiting.find((movement) => {
    if (movement.edOutcome !== undefined || movement.closure || movement.stage === "pulled") return false;
    const patientId = resolvePatientIdentity(movement).patient?.id;
    return edBedSearchStep(movement, openWardReferralFor(patientId, referrals) !== undefined) === "refer";
  });
  const patientId = next ? resolvePatientIdentity(next).patient?.id : undefined;
  const href = edReferralSheetHref(patientId, ED_ID);
  const request = referralSheetRequestFromSearch(new URLSearchParams(href.split("?")[1] ?? ""));
  const close = () => setOpen(false);

  return (
    <Sheet
      id="redesign-refer-ward-drawer"
      open={open}
      onClose={() => (closeRef.current ? closeRef.current() : close())}
      ariaLabel="Referrals"
      headerHidden
      placement="right"
      testId="redesign-refer-ward-sheet"
      desktopBackdropClassName={shell.drawerBackdrop}
      contentClassName={`${shell.drawerSheet} ${shell.drawerSheetReferral}`}
      bodyClassName={shell.referralCarrierBody}
    >
      {open ? (
        <ReferralDrawerRedesign
          initialCategory={request.category}
          initialDestination={request.destination}
          initialPatientId={request.personId}
          initialOriginSiteCode={request.originSiteCode}
          closeRequestRef={closeRef}
          onClose={close}
        />
      ) : null}
    </Sheet>
  );
}
