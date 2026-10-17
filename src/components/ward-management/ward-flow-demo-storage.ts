import type { Instant } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { broadcastDispatchEvent } from "./ward-flow-provider-helpers";
import type { WardFlowState } from "./ward-flow-reducer";
import {
  isValidStoredWardFlowState,
  migrateStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
  withInboxStreamADefaults,
} from "./ward-flow-storage-validation";
import { clearWardFlowDraftCaches } from "./use-dirty-state-guard";

/**
 * The demonstration's one saved session in `sessionStorage`: its shape, its version, and the guarded
 * read and write. Kept apart from `WardFlowProvider` so the provider stays under its line cap.
 */

export const WARD_FLOW_DEMO_STORAGE_KEY = "ward-flow-demo-state-v1";

/**
 * ⚠️ **BUMP THIS WHENEVER THE STORED SHAPE CHANGES**, not only the key. Audit finding ISSUE-P1-83
 * (2026-09-16, defect 3): the version used to live only in the storage KEY's own "-v1" suffix, which
 * nothing ever read back — a shape change would have restored a stale-shaped object straight into
 * `useReducer` with no check at all. It now travels INSIDE the payload and is checked on every read
 * (`isValidDemoPayload`), so a version bump discards an old-shaped save rather than trusting it.
 *
 * 🔴 **BUMPED 2 → 3, 2026-09-17, Y4 privacy remediation.** Two independent shape changes land in the
 * same pass: the payload no longer carries `anchorOffsetMinutes` at all (see `tryReadDemoState`'s own
 * comment for why comparing it was the defect, not the fix), and `state.configuration` is now
 * validated on restore (`isValidStoredWardFlowState`) rather than trusted unchecked. A v2 save read
 * by this build would either be missing the fields the new checks require or carry an unvalidated
 * configuration — discarding it rather than reading either the old shape or an invented default is
 * this project's ordinary conservative-degradation rule, applied here as everywhere else.
 */
// v4 stores the synthetic clock and validates nested recovery records. v5 (2026-09-25): a bed
// release now names the admission it belongs to (`BedRelease.admissionId`, owner decision
// 2026-09-25) — a v4 save has no such field and no honest migration exists, so it is refused
// exactly like every other version mismatch above, never guessed or backfilled.
// v6 (2026-10-08): explicit deterioration/pause, recorded ATS and corroborated
// arrival/capacity conflicts; reciprocal runtime admission links are validated.
// Old automatic saves are refused rather than silently migrating clinical facts.
// v7 (2026-10-09, stream D): planned admissions and their id sequence are part of the state.
// A v6 save is the one exception to refusal (Josh, 9 Oct 2026): it gains an empty booking list
// (`migrateStoredWardFlowState`) and is then validated exactly as a v7 save.
export const WARD_FLOW_DEMO_STORAGE_VERSION = WARD_FLOW_STORED_STATE_VERSION;

/**
 * What actually goes to `sessionStorage`. Carries the world's calendar day ALONGSIDE the state, not
 * only inside it, so a restore can refuse a save that no longer describes THIS world before it ever
 * touches the reducer — see `tryReadDemoState`'s own comment for why a mismatch here means discard,
 * never a silent timestamp shift.
 */
type WardFlowDemoPayload = {
  version: number;
  /** `dayZero.getTime()` at save — a calendar day, not a duration; compared for exact equality. */
  dayZero: number;
  /** Redundant with `state.worldGeneration`, and deliberately so: a payload where the two disagree
   *  is corrupt in a way a shape check alone would not catch, and is discarded rather than trusted. */
  worldGeneration: number;
  now: Instant;
  savedAtAbsolute: number;
  state: WardFlowState;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDemoPayload(value: unknown): value is WardFlowDemoPayload {
  if (!isPlainObject(value)) return false;
  if (typeof value.version !== "number") return false;
  if (typeof value.dayZero !== "number") return false;
  if (typeof value.worldGeneration !== "number") return false;
  if (!Number.isFinite(value.now) || !Number.isFinite(value.savedAtAbsolute)) return false;
  return isValidStoredWardFlowState(value.state);
}

export const STORAGE_UNAVAILABLE =
  "Demo storage is unavailable. Changes stay in memory and may be lost when this page closes.";
const SAVE_REJECTED =
  "The saved demonstration could not be restored safely. A fresh synthetic demonstration has started.";

type DemoRead = { saved?: WardFlowDemoPayload; recoveryNotice?: string };

/** A parsed save brought to this build's version when a migration exists (v6 only); any other
 *  version is returned unchanged, so the version check below still refuses it. */
function upgradeDemoPayload(value: unknown): unknown {
  if (!isPlainObject(value) || value.version === WARD_FLOW_DEMO_STORAGE_VERSION) return value;
  const state = migrateStoredWardFlowState(value.state, value.version);
  return state === null ? value : { ...value, version: WARD_FLOW_DEMO_STORAGE_VERSION, state };
}

/** Same-day reload includes time away. A different day or backward clock starts a fresh demo;
 * no saved event or entered time is shifted or reconstructed. Storage access is entirely guarded. */
export function tryReadDemoState(dayZero: Date, mountedAtAbsolute: number, rawOverride?: string): DemoRead {
  if (typeof window === "undefined") return {};
  try {
    const raw = rawOverride ?? window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    if (!raw) return {};
    let stored: unknown;
    try {
      stored = JSON.parse(raw);
    } catch {
      return { recoveryNotice: SAVE_REJECTED };
    }
    const parsed = upgradeDemoPayload(stored);
    if (
      !isValidDemoPayload(parsed) ||
      parsed.version !== WARD_FLOW_DEMO_STORAGE_VERSION ||
      parsed.dayZero !== dayZero.getTime() ||
      parsed.worldGeneration !== parsed.state.worldGeneration ||
      parsed.savedAtAbsolute > mountedAtAbsolute ||
      parsed.now < NOW_ANCHOR + parsed.state.clockOffsetMinutes ||
      parsed.state.auditEvents.some((event) => event.at !== null && event.at > parsed.now)
    )
      return { recoveryNotice: SAVE_REJECTED };
    // absoluteWallClockMinutes encodes the device's wall calendar, including its offset.
    // Reading that value through UTC preserves the recorded device time without adding an offset twice.
    const savedAt = new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(parsed.savedAtAbsolute * 60_000));
    return {
      saved: { ...parsed, state: withInboxStreamADefaults(parsed.state) },
      recoveryNotice: `Restored the last successful save from ${savedAt} (device time). Later changes may not have been saved.`,
    };
  } catch {
    // Do not repeat stored content or an exception message in the recovery notice.
    return { recoveryNotice: STORAGE_UNAVAILABLE };
  }
}

export function tryWriteDemoState(
  state: WardFlowState,
  dayZero: Date,
  now: Instant,
  savedAtAbsolute: number,
  senderId?: string,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: WardFlowDemoPayload = {
      version: WARD_FLOW_DEMO_STORAGE_VERSION,
      dayZero: dayZero.getTime(),
      worldGeneration: state.worldGeneration,

      now,
      savedAtAbsolute,
      // Refusal records are never stored (Josh, D-18, 25 Sept 2026): a refusal can quote a
      // caller-supplied id back in `reason`/`id`, so a saved day keeps its work but not its refusals.
      state: { ...state, rejections: [] },
    };
    const serialized = JSON.stringify(payload);
    window.sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, serialized);
    if (senderId) {
      broadcastDispatchEvent("SYNC_SAVED_STATE", senderId, serialized);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearWardFlowDemoState(): boolean {
  clearWardFlowDraftCaches();
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.removeItem(WARD_FLOW_DEMO_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
