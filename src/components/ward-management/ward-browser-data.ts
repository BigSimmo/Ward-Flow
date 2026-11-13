import { endFrontDoorPass } from "@/components/ward-management/front-door/front-door-pass-client";
import { clearSessionDrafts } from "./ward-session-drafts";
import { syncWardDeskHeldCookie } from "./shell/ward-desk-early";

/**
 * Ward Flow's browser storage, cleared when a signed-in session ends (overall review 20 Oct 2026,
 * item 2.8: signing out used to end the session but leave saved bed keys, recents, favourites,
 * "since you last looked" snapshots, filters and drafts on the device).
 *
 * The sweep is by prefix, so a key added later under any of these prefixes is cleared without
 * being listed here (`tests/ward-browser-data.test.ts` checks every key in the source is
 * covered). Keys of other apps on the same origin, such as the shared theme
 * (`clinical-kb-theme`), never match and are left alone.
 *
 * A short list of device display settings is kept, because they hold nothing about a patient or a
 * person and the next person at the device expects the screen to look the same. The old Discreet
 * names key (`ward-flow-discreet-names`, removed for D-83) is no longer kept, so sign-out clears it.
 */
const WARD_FLOW_STORAGE_PREFIXES = ["ward-", "ward_", "wardflow", "wf-"] as const;

/** Device display settings kept at sign-out. Exact names, or a prefix ending in `_`. */
export const WARD_FLOW_DEVICE_SETTING_KEYS = [
  "ward-flow-rail",
  "ward-flow-row-density",
  "ward-flow-reduced-motion",
  "ward-flow-high-contrast",
  "ward-flow-character-shortcuts",
  "ward-flow-audio-buzz-pref",
  "ward-flow-act-now-notifications",
  "ward-flow-statistics-samples",
  "ward_flow_feature_flags",
  "ward_flow_delays_order",
] as const;
const WARD_FLOW_DEVICE_SETTING_PREFIXES = ["ward_flow_choice_"] as const;

/** Whether a storage key belongs to Ward Flow (and so is in scope for the sign-out sweep). */
export function isWardFlowStorageKey(key: string): boolean {
  return WARD_FLOW_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Whether a Ward Flow key is a device display setting kept at sign-out. */
function isWardFlowDeviceSetting(key: string): boolean {
  return (
    (WARD_FLOW_DEVICE_SETTING_KEYS as readonly string[]).includes(key) ||
    WARD_FLOW_DEVICE_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

type SweepableStorage = Pick<Storage, "key" | "length" | "removeItem">;

function sweep(storage: SweepableStorage): string[] {
  const doomed: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key !== null && isWardFlowStorageKey(key) && !isWardFlowDeviceSetting(key)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
  return doomed;
}

function browserStorages(): SweepableStorage[] {
  if (typeof window === "undefined") return [];
  const found: SweepableStorage[] = [];
  for (const read of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      found.push(read());
    } catch {
      // Storage blocked: nothing was saved there to clear.
    }
  }
  return found;
}

/**
 * Remove every Ward Flow key from local and session storage except the device display settings.
 * Each store is swept separately, so a blocked or failing one never stops the other. Returns the
 * removed key names (names only) for tests.
 */
export function clearWardFlowBrowserData(storages: readonly SweepableStorage[] = browserStorages()): string[] {
  const removed: string[] = [];
  for (const storage of storages) {
    try {
      removed.push(...sweep(storage));
    } catch {
      // Keep going: the other store still needs clearing.
    }
  }
  return removed;
}

/**
 * F-65 (K8, RC 5.1, A12-03, A14-17, A14-24, approved by Josh 13 Nov 2026): what Reset demo clears
 * from this browser. Each entry belongs to the demo day, not to the person or the device, and
 * outlived a reset before: the Midland team's decisions, the TV lock, the "My list" and place pins,
 * the Home ED filter, "since you last looked" pictures and the census bed opener. An entry also
 * covers its own `entry:...` keys. Device display settings, the saved day itself (the provider
 * reseeds and saves it) and drafts (cleared on every world change) are not on it. The device-only
 * Tools reminders and call log (RC 5.2, D-197 item 2) are on it too, because their stores load only
 * with the Tools sheet, Alerts reminders or Leave: Settings' Clear session data can run before either
 * store has loaded. A loaded store also empties what it holds through its own `onWardDemoReset`.
 * `tests/ward-fix-T-demo-reset-browser.dom.test.tsx` keeps it equal to each store's own key.
 */
export const WARD_DEMO_DAY_STORAGE_KEYS = [
  "ward-flow:midland-decisions:v1",
  "ward-flow:tv-lock:v1",
  "ward-flow-my-patients",
  "ward-flow-my-wards",
  "ward-hub-pinned",
  "ward_flow_home_ed_filter",
  "ward-flow-coordinator-last-look",
  "wardflow:census-bed-opener",
  "wardflow:census-bed-opener-target",
  "wf-mock-tools-reminders",
  "wf-mock-tools-call-log",
] as const;

function isDemoDayKey(key: string): boolean {
  return WARD_DEMO_DAY_STORAGE_KEYS.some((entry) => key === entry || key.startsWith(`${entry}:`));
}

/** What a Reset demo clears besides the browser keys: `desk` is false where the server owns the desk. */
export type WardDemoResetScope = { readonly desk: boolean };
const demoResets = new Set<(scope: WardDemoResetScope) => void>();

/**
 * Register a store's part of Reset demo (F-65), run after the keys are cleared: the desk and the
 * role demo put this tab back on the bed coordinator's desk. A store registers when its module loads.
 */
export function onWardDemoReset(reset: (scope: WardDemoResetScope) => void): void {
  demoResets.add(reset);
}

/**
 * Reset demo's browser half (F-65): clears every demo-day key from local and session storage, tells
 * any screen showing one (a storage event per key, which every such store already listens for), then
 * runs the registered resets. Returns the removed key names (names only) for tests.
 */
export function resetWardDemoBrowserState(
  scope: WardDemoResetScope,
  storages: readonly SweepableStorage[] = browserStorages(),
): string[] {
  const removed: string[] = [];
  for (const storage of storages) {
    try {
      const doomed: string[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key !== null && isDemoDayKey(key)) doomed.push(key);
      }
      for (const key of doomed) storage.removeItem(key);
      removed.push(...doomed);
    } catch {
      // Keep going: the other store still needs clearing.
    }
  }
  if (typeof window !== "undefined")
    for (const key of new Set(removed)) {
      try {
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: null }));
      } catch {
        // No StorageEvent here: a reload shows the cleared value.
      }
    }
  for (const reset of demoResets) {
    try {
      reset(scope);
    } catch {
      // Keep going: the remaining resets still run.
    }
  }
  return removed;
}

/**
 * Per-account memory held at module level (break glass records, cover, previews, step-up confirms,
 * search recents, handed-off typed text, the downtime pack) survives a sign-out in the same tab, so
 * each such store registers how to forget itself here (Codex review on PR #487). A store registers
 * when its module loads; one that never loaded holds nothing to forget.
 */
const sessionEndResets = new Set<(scope: WardSessionEndScope) => void>();

/** "tab": only this tab signs out (audit 24-3 SM-1), so local storage, shared with other tabs, stays. */
export type WardSessionEndScope = "browser" | "tab";

/** Register a module-level store's reset, run once each time a signed-in session ends. */
export function onWardSessionEnd(reset: (scope: WardSessionEndScope) => void): void {
  sessionEndResets.add(reset);
}

/**
 * Audit 4 A4-07: leave-saves ("since you last looked" pictures) wait one task, and the screen
 * re-renders signed out before it closes, so a save scheduled after the sweep wrote the picture
 * back. Each leave-save carries a ticket taken when it was scheduled. It may write only if no
 * session ended since (so a later sign-in never revives it) and its account context was not
 * ended: never the ended context, and never the signed-out `null` until someone signs in again.
 */
let sessionEpoch = 0;
const liveAccounts = new Set<object>();
const endedAccounts = new WeakSet<object>();
let signedOutSinceEnd = false;

/** Leave-saving screens report their account context while rendering, before any effect runs. */
export function noteWardSessionAccount(account: object | null): void {
  if (account === null || endedAccounts.has(account)) return;
  liveAccounts.add(account);
  signedOutSinceEnd = false;
}

export type WardLeaveSaveTicket = {
  readonly epoch: number;
  readonly account: object | null;
  readonly signedOut: boolean;
};

/** Take when scheduling a leave-save; check with `wardLeaveSaveAllowed` at the moment of writing. */
export function wardLeaveSaveTicket(account: object | null): WardLeaveSaveTicket {
  noteWardSessionAccount(account);
  return { epoch: sessionEpoch, account, signedOut: account === null && signedOutSinceEnd };
}

export function wardLeaveSaveAllowed(ticket: WardLeaveSaveTicket): boolean {
  if (ticket.epoch !== sessionEpoch || ticket.signedOut) return false;
  return ticket.account === null || !endedAccounts.has(ticket.account);
}

/** Runs first, synchronously, in both session ends: every ticket and context so far is spent. */
function fenceWardLeaveSaves(): void {
  sessionEpoch += 1;
  for (const account of liveAccounts) endedAccounts.add(account);
  liveAccounts.clear();
  signedOutSinceEnd = true;
}

/**
 * What the app runs when a signed-in session ends: fence any open form's draft writer first (so a
 * mounted sheet cannot write its draft back), forget every per-account memory store, then sweep
 * the storage. A failing reset never stops the others or the sweep.
 */
export function endWardFlowBrowserSession(): void {
  void endWardFlowBrowserSessionAndPass();
}

/**
 * The same, resolving once the front door's pass has ended (Leave the demo waits on it): true when
 * the server confirmed it, false when it could not be ended in time.
 */
export function endWardFlowBrowserSessionAndPass(): Promise<boolean> {
  fenceWardLeaveSaves();
  clearSessionDrafts();
  for (const reset of sessionEndResets) {
    try {
      reset("browser");
    } catch {
      // Keep going: the remaining stores and the storage still need clearing.
    }
  }
  clearWardFlowBrowserData();
  syncWardDeskHeldCookie(null);
  // The front door's pass ends with the sign-in, so the next person at this browser starts outside.
  return endFrontDoorPass();
}

/**
 * Audit 24-3 SM-1: this tab signs out while another tab on the same sign-in stays in use. Fence
 * the drafts, forget this tab's memory stores and sweep this tab's session storage, but leave
 * local storage, which the other tab shares, as it is.
 */
export function endWardFlowTabSession(): void {
  fenceWardLeaveSaves();
  clearSessionDrafts();
  for (const reset of sessionEndResets) {
    try {
      reset("tab");
    } catch {
      // Keep going: the remaining stores and the storage still need clearing.
    }
  }
  if (typeof window === "undefined") return;
  try {
    clearWardFlowBrowserData([window.sessionStorage]);
  } catch {
    // Session storage blocked: nothing was saved there to clear.
  }
}
