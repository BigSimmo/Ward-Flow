import { clearSessionDrafts } from "./ward-session-drafts";

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
 * person and the next person at the device expects the screen to look the same. "Hide names"
 * (`ward-flow-discreet-names`) is kept on purpose: clearing it would show names to the next person.
 */
const WARD_FLOW_STORAGE_PREFIXES = ["ward-", "ward_", "wardflow", "wf-"] as const;

/** Device display settings kept at sign-out. Exact names, or a prefix ending in `_`. */
export const WARD_FLOW_DEVICE_SETTING_KEYS = [
  "ward-flow-rail",
  "ward-flow-row-density",
  "ward-flow-discreet-names",
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
 * back. After a session ends, a leave-save may write only for an account context that signed in
 * afterwards: a new context object, never the ended one or the signed-out `null`.
 */
let lastSeenAccount: object | null = null;
let endedAccount: object | null | undefined;

/** Leave-saving screens report their current account context after each render. */
export function noteWardSessionAccount(account: object | null): void {
  lastSeenAccount = account;
  if (endedAccount !== undefined && account !== null && account !== endedAccount) endedAccount = undefined;
}

/** Whether a leave-save made under `account` may still write, checked at the moment of writing. */
export function wardLeaveSaveAllowed(account: object | null): boolean {
  return endedAccount === undefined || (account !== null && account !== endedAccount);
}

/**
 * What the app runs when a signed-in session ends: fence any open form's draft writer first (so a
 * mounted sheet cannot write its draft back), forget every per-account memory store, then sweep
 * the storage. A failing reset never stops the others or the sweep.
 */
export function endWardFlowBrowserSession(): void {
  endedAccount = lastSeenAccount;
  clearSessionDrafts();
  for (const reset of sessionEndResets) {
    try {
      reset("browser");
    } catch {
      // Keep going: the remaining stores and the storage still need clearing.
    }
  }
  clearWardFlowBrowserData();
}

/**
 * Audit 24-3 SM-1: this tab signs out while another tab on the same sign-in stays in use. Fence
 * the drafts, forget this tab's memory stores and sweep this tab's session storage, but leave
 * local storage, which the other tab shares, as it is.
 */
export function endWardFlowTabSession(): void {
  endedAccount = lastSeenAccount;
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
