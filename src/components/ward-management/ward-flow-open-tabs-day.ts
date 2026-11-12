import { useEffect, type RefObject } from "react";
import { WARD_FLOW_DEMO_STORAGE_KEY } from "./ward-flow-demo-storage";
import { broadcastDispatchEvent, getOrCreateBroadcastInstanceId } from "./ward-flow-provider-helpers";
import { markOtherTabChangedDay } from "./shell/ward-other-tab-day";

/**
 * Design audit DA-01: opening a new demo tab must not reset the day in the tabs already open.
 *
 * `freshSeedRef` is true while the tab is still on the untouched seed day: nothing restored,
 * adopted or done in it (the provider clears it). Such a tab never broadcasts that seed. Once it has
 * settled it asks the open tabs for their day. A tab that has really worked on a day answers with its
 * saved copy as an ordinary `SYNC_SAVED_STATE`, which the new tab adopts through the provider's
 * existing sync path. With no other tab open nothing answers and the seed day stays. `enabled` is
 * false for a pinned clock, in shared mode and whenever this tab is not saving on the device.
 *
 * SD-03 (audit, 5 Nov 2026): a tab that owns its day (`ownsDayRef`) never takes a peer's save. When
 * a peer saves a different day, the shell now says the tabs have split (`ward-other-tab-day.tsx`).
 */
export function useOpenTabsDay(
  enabled: boolean,
  freshSeedRef: RefObject<boolean>,
  instanceIdRef: { current: string },
  ownsDayRef?: RefObject<boolean>,
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
      if (data?.type !== "WARD_FLOW_DISPATCH" || data.senderId === instanceId) return;
      if (data.eventType === "SYNC_SAVED_STATE" && ownsDayRef?.current && typeof data.payload === "string") {
        if (otherTabDayDiffers(data.payload)) markOtherTabChangedDay();
        return;
      }
      if (data.eventType !== "REQUEST_SAVED_STATE" || freshSeedRef.current) return;
      try {
        const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
        if (raw) broadcastDispatchEvent("SYNC_SAVED_STATE", instanceId, raw);
      } catch {
        // Storage unreadable: the new tab keeps its seed day.
      }
    };
    if (freshSeedRef.current) broadcastDispatchEvent("REQUEST_SAVED_STATE", instanceId);
    return () => channel.close();
  }, [enabled, freshSeedRef, instanceIdRef, ownsDayRef]);
}

/** True when a peer's saved day is not this tab's own saved day (both stored without refusals). */
function otherTabDayDiffers(peerPayload: string): boolean {
  try {
    const own = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    if (!own) return false;
    const peer = JSON.parse(peerPayload) as { dayZero?: unknown; state?: unknown };
    const mine = JSON.parse(own) as { dayZero?: unknown; state?: unknown };
    // A save for another calendar day is refused by the restore fence anyway; it is not a split.
    if (peer.dayZero !== mine.dayZero) return false;
    return worldsCertainlyDiffer(peer.state, mine.state) || JSON.stringify(peer.state) !== JSON.stringify(mine.state);
  } catch {
    return false;
  }
}

/**
 * Review finding 13 (12 Nov 2026): true only when two saved worlds' JSON must differ, read from their
 * top level alone: a string, boolean or finite number that differs, or a list of another length.
 * False means "not known", so the caller still compares the whole JSON. Saves an encode of two
 * ~480 KB worlds on most changes from another tab. `rejections` is skipped: it is never stored.
 */
export function worldsCertainlyDiffer(a: unknown, b: unknown): boolean {
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  for (const key of Object.keys(left)) {
    if (key === "rejections") continue;
    const x = left[key];
    const y = right[key];
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) return true;
    } else if (typeof x === typeof y && (typeof x === "string" || typeof x === "boolean")) {
      if (x !== y) return true;
    } else if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
      if (x !== y) return true;
    }
  }
  return false;
}

/** The sender id a save is broadcast under, or none when it must not reach other tabs (`skip`). */
export function seedSafeSenderId(skip: boolean, instanceIdRef: { current: string }): string | undefined {
  return skip ? undefined : getOrCreateBroadcastInstanceId(instanceIdRef);
}
