"use client";

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { WardOfflineBanner } from "@/components/ward-management/shell/ward-offline-banner";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";

import { NoticeStack } from "../notices/notice-stack";
import styles from "./pop-state-offline.module.css";

/**
 * Preview only: the browser's own "no connection" flag, switched on while this mock-up is open and
 * given back when it closes. Everything that reads `navigator.onLine` (the offline notice, the toast
 * provider's "Saved on this device only." note) then behaves exactly as it does offline.
 */
function subscribeOffline(): () => void {
  const had = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  window.dispatchEvent(new Event("offline"));
  return () => {
    if (had) Object.defineProperty(navigator, "onLine", had);
    else delete (navigator as { onLine?: boolean }).onLine;
    window.dispatchEvent(new Event("online"));
  };
}

const subscribeNothing = () => () => {};

function usePretendOffline(): boolean {
  const ready = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  useEffect(() => (ready ? subscribeOffline() : undefined), [ready]);
  return ready;
}

/**
 * The Offline mock-up: Home with the device offline. The real offline notice
 * (shell/ward-offline-banner.tsx) sits pinned under the header, where the app's banner holder puts
 * it, and the header's live chip turns to Offline by itself. A save made now shows its notice with the
 * provider's offline note, "Saved on this device only." (ward-offline-copy.ts), word for word.
 *
 * Final round (D-91): the save notice is drawn in the same notice style as the Toast mock-up (draft
 * PR #1124's card and phone pill, copied into notices/), so it rests clear of the phone's dock too.
 * It is today's Pull the bed toast for the first accepted referral still waiting for its bed, naming
 * the person surname first (round 2). The app adds the offline note itself only while a device is
 * saving, and the preview's pinned world never saves, so the note is written in here.
 */
export function PopStateOffline({ page }: { page: ReactNode }) {
  usePretendOffline();
  const { referrals, units, movements } = useWardFlowSelect("referrals", "units", "movements");
  const first = useMemo(
    () => acceptedReferralsAwaitingPull(referrals, units, movements)[0],
    [referrals, units, movements],
  );
  const unitName = first?.unitName ?? "Bunbury Acute Psychiatric Unit";
  // The notice names who the bed was pulled for, surname first (D-83), through the same name
  // display Pull the bed uses (so discreet names still apply).
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const who = first ? patientOf(first.referral) : undefined;
  const name = who ? nameFor(who.formalName, who.umrn) : undefined;
  const title = name ? `Bed pulled at ${unitName} for ${name}` : `Bed pulled at ${unitName}`;

  return (
    <>
      <div className={styles.holder} data-wf-bar-notes="">
        <WardOfflineBanner />
      </div>
      {page}
      <NoticeStack
        key={title}
        notices={[{ id: "pulled-offline", tone: "success", title, body: WARD_OFFLINE_SAVED_NOTE, autoDismiss: true }]}
      />
    </>
  );
}
