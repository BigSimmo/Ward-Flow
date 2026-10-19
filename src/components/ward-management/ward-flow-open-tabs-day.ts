import { useEffect, type RefObject } from "react";
import { WARD_FLOW_DEMO_STORAGE_KEY } from "./ward-flow-demo-storage";
import { broadcastDispatchEvent, getOrCreateBroadcastInstanceId } from "./ward-flow-provider-helpers";

/**
 * Design audit DA-01: opening a new demo tab must not reset the day in the tabs already open.
 *
 * `freshSeedRef` is true while the tab is still on the untouched seed day: nothing restored,
 * adopted or done in it (the provider clears it). Such a tab never broadcasts that seed. Once it has
 * settled it asks the open tabs for their day. A tab that has really worked on a day answers with its
 * saved copy as an ordinary `SYNC_SAVED_STATE`, which the new tab adopts through the provider's
 * existing sync path. With no other tab open nothing answers and the seed day stays. `enabled` is
 * false for a pinned clock, in shared mode and whenever this tab is not saving on the device.
 */
export function useOpenTabsDay(
  enabled: boolean,
  freshSeedRef: RefObject<boolean>,
  instanceIdRef: { current: string },
): void {
  useEffect(() => {
    if (!enabled || typeof window.BroadcastChannel === "undefined") return;
    const instanceId = getOrCreateBroadcastInstanceId(instanceIdRef);
    let channel: BroadcastChannel;
    try {
      channel = new window.BroadcastChannel("ward-flow-sync");
    } catch {
      return;
    }
    channel.onmessage = ({ data }) => {
      if (data?.type !== "WARD_FLOW_DISPATCH" || data.eventType !== "REQUEST_SAVED_STATE") return;
      if (data.senderId === instanceId || freshSeedRef.current) return;
      try {
        const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
        if (raw) broadcastDispatchEvent("SYNC_SAVED_STATE", instanceId, raw);
      } catch {
        // Storage unreadable: the new tab keeps its seed day.
      }
    };
    if (freshSeedRef.current) broadcastDispatchEvent("REQUEST_SAVED_STATE", instanceId);
    return () => channel.close();
  }, [enabled, freshSeedRef, instanceIdRef]);
}

/** The sender id a save is broadcast under, or none when it must not reach other tabs (`skip`). */
export function seedSafeSenderId(skip: boolean, instanceIdRef: { current: string }): string | undefined {
  return skip ? undefined : getOrCreateBroadcastInstanceId(instanceIdRef);
}
