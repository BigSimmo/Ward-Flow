import type { WardFlowState } from "./ward-flow-reducer";

/**
 * Small helpers for `WardFlowProvider`, kept here so the provider stays under its line cap.
 * Tabs share one channel to say that a change was made, by event type only (never its content).
 */
let sharedBroadcastChannel: BroadcastChannel | null = null;

function getSharedBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof window.BroadcastChannel === "undefined") {
    return null;
  }
  try {
    if (!sharedBroadcastChannel) {
      sharedBroadcastChannel = new window.BroadcastChannel("ward-flow-sync");
    }
    return sharedBroadcastChannel;
  } catch {
    return null;
  }
}

export function broadcastDispatchEvent(eventType: string): void {
  try {
    const channel = getSharedBroadcastChannel();
    if (channel) {
      channel.postMessage({ type: "WARD_FLOW_DISPATCH", eventType });
    }
  } catch {
    sharedBroadcastChannel = null;
  }
}

/**
 * Audit finding ISSUE-P1-83, defect 3c: `OPEN_DISCHARGE_RECORD` requests are identified by a
 * monotonically increasing `requestId` (`WardFlowWorld`'s `openRequestSequence` below), and
 * `readOpenedDischargeRecord` (`ward-discharge-records.ts`) finds a request's own audit receipt by
 * matching `requestId` against `state.auditEvents`. A restored session's audit log already holds
 * `requestId`s from before the restore; if the counter restarted at 0, the next open would either
 * collide with an old receipt for a DIFFERENT admission (denied as a replay) or, had none existed to
 * collide with, still leave the door open for the very next id to collide once the log grew back to
 * where it left off. Continuing past the highest id already on the restored log is the only value
 * that can never collide with it.
 */
export function nextOpenRequestSequence(auditEvents: WardFlowState["auditEvents"]): number {
  let highest = -1;
  for (const entry of auditEvents) {
    if (entry.category !== "record-access" || entry.action !== "OPEN_DISCHARGE_RECORD") continue;
    const requestId = entry.details.requestId;
    if (typeof requestId === "number" && Number.isFinite(requestId) && requestId > highest) highest = requestId;
  }
  return highest + 1;
}
