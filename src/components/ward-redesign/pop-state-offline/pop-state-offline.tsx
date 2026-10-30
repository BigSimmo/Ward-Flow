"use client";

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { WardOfflineBanner } from "@/components/ward-management/shell/ward-offline-banner";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";
import { useOptionalToast } from "@/components/wf";

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
 * it, and a save made now shows its toast with the provider's offline note, "Saved on this device
 * only." (ward-offline-copy.ts). The header's live chip turns to Offline by itself. The toast is today's Pull the bed toast for the first accepted
 * referral still waiting for its bed, worded as the app words it.
 */
export function PopStateOffline({ page }: { page: ReactNode }) {
  usePretendOffline();
  const toast = useOptionalToast();
  const { referrals, units, movements } = useWardFlowSelect("referrals", "units", "movements");
  const unitName = useMemo(
    () => acceptedReferralsAwaitingPull(referrals, units, movements)[0]?.unitName,
    [referrals, units, movements],
  );

  useEffect(() => {
    if (!toast || !unitName) return;
    let id: string | undefined;
    // The app's toast provider adds "Saved on this device only." itself, but only while the world is
    // being kept on this device, and the preview's pinned world never saves. So the note is written in
    // here, as it reads on a device that is saving (the same words, from ward-offline-copy.ts).
    const timer = window.setTimeout(() => {
      id = toast.push({
        tone: "success",
        title: `Bed pulled at ${unitName}`,
        body: WARD_OFFLINE_SAVED_NOTE,
        skipOfflineNote: true,
        duration: 0,
      });
    }, 50);
    return () => {
      window.clearTimeout(timer);
      if (id) toast.dismiss(id);
    };
  }, [toast, unitName]);

  return (
    <>
      <div className={styles.holder} data-wf-bar-notes="">
        <WardOfflineBanner />
      </div>
      {page}
    </>
  );
}
