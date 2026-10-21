import { useEffect, useMemo, useState } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import { broadcastDispatchEvent } from "./ward-flow-provider-helpers";
import type { WardFlowState } from "./ward-flow-reducer";
import type { ScenarioFileBuild, ScenarioFileRead } from "./ward-flow-scenario-file";
import type { TypedTextLedger } from "./ward-flow-typed-text-ledger";
import type { FixtureWorlds } from "./ward-flow-typed-text-scrub";
import {
  RESTORED_NOTICE_PREFIX,
  STORAGE_UNAVAILABLE,
  WARD_FLOW_DEMO_STORAGE_KEY,
  WARD_FLOW_STORED_STATE_VERSION,
} from "./ward-flow-demo-storage-constants";

export { RESTORED_NOTICE_PREFIX, STORAGE_UNAVAILABLE, WARD_FLOW_DEMO_STORAGE_KEY };

/**
 * The demonstration's one saved session in `sessionStorage`: its shape, its version, and the guarded
 * write. Kept apart from `WardFlowProvider` so the provider stays under its line cap. The guarded
 * read (`tryReadDemoState`) lives in `ward-flow-demo-restore.ts` and loads on demand through
 * `readDemoStateLater`: it carries the stored-state schema, which every phone page would otherwise
 * download up front (Josh, 21 Oct 2026: no script budget raises).
 */

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
export type WardFlowDemoPayload = {
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

export type DemoRead = { saved?: WardFlowDemoPayload; recoveryNotice?: string };

let demoRestore: typeof import("./ward-flow-demo-restore") | undefined;

/** Loads the restore module once; afterwards a mount reads its save in the same render as before. */
export function loadDemoRestore(): Promise<typeof import("./ward-flow-demo-restore")> {
  return import("./ward-flow-demo-restore").then((module) => (demoRestore = module));
}

/** `tryReadDemoState`, loaded on first use. A failed load counts as unavailable storage, so the save
 *  is neither restored nor overwritten while the page keeps working in memory. */
export function readDemoStateLater(dayZero: Date, mountedAtAbsolute: number, rawOverride?: string): Promise<DemoRead> {
  return loadDemoRestore().then(
    ({ tryReadDemoState }) => tryReadDemoState(dayZero, mountedAtAbsolute, rawOverride),
    () => ({ recoveryNotice: STORAGE_UNAVAILABLE }),
  );
}

let typedTextScrub: typeof import("./ward-flow-typed-text-scrub") | undefined;

/**
 * The device copy of a session holding typed text (`ward-flow-typed-text-scrub.ts`) loads on demand,
 * like the saved-session read: it carries the restore fence, which the first screen does not need.
 */
export function loadTypedTextScrub(): Promise<typeof import("./ward-flow-typed-text-scrub")> {
  return import("./ward-flow-typed-text-scrub").then((module) => (typedTextScrub = module));
}

type TypedTextHeld = { typedTextSeen: boolean; typedTextLedger?: TypedTextLedger; typedTextFromFile?: boolean };

/**
 * What may be written to this device: the world itself while it holds no typed text, otherwise its
 * copy with every typed value replaced (D-18, Josh 21 Oct 2026). `null` means nothing may be written
 * (`locked`, or no safe copy could be made), and `undefined` that the copy's code has not loaded yet.
 */
export function deviceCopyOf(
  state: WardFlowState,
  held: TypedTextHeld,
  locked: boolean,
  fixtureWorlds: FixtureWorlds,
): WardFlowState | null | undefined {
  if (!held.typedTextSeen) return state;
  if (locked) return null;
  return typedTextScrub?.redactTypedTextForDevice(
    state,
    held.typedTextLedger ?? [],
    fixtureWorlds,
    held.typedTextFromFile,
  );
}

const SCENARIO_TOOLS_UNAVAILABLE = "The scenario file tools could not load, so nothing was changed. Try again.";

/** The saved session for this mount, read once it has loaded; undefined until then and whenever
 *  saving on this device does not apply. The provider adopts it (`sessionAdopted`) when it arrives. */
export function useDemoStateRead(
  enabled: boolean,
  dayZero: Date,
  mountedAtAbsolute: number | null,
): DemoRead | undefined {
  const [held, setHeld] = useState<{ dayZero: Date; mountedAtAbsolute: number; read: DemoRead }>();
  // Once loaded (a later mount, or tests that preload it), the read is synchronous, as it always was.
  const loadedRead = useMemo(
    () =>
      enabled && mountedAtAbsolute !== null ? demoRestore?.tryReadDemoState(dayZero, mountedAtAbsolute) : undefined,
    [enabled, dayZero, mountedAtAbsolute],
  );
  useEffect(() => {
    if (!enabled || mountedAtAbsolute === null || loadedRead) return;
    let live = true;
    void readDemoStateLater(dayZero, mountedAtAbsolute).then((read) => {
      if (live) setHeld({ dayZero, mountedAtAbsolute, read });
    });
    return () => {
      live = false;
    };
  }, [enabled, dayZero, mountedAtAbsolute, loadedRead]);
  if (loadedRead) return loadedRead;
  return enabled && held?.dayZero === dayZero && held.mountedAtAbsolute === mountedAtAbsolute ? held.read : undefined;
}

/** `buildScenarioFile` and `readScenarioFile` at this build's state version, loaded on first use for
 *  the same reason as `readDemoStateLater`. A failed load changes nothing and says so. */
/** Asks the browser to confirm a refresh or close while `active`: the day would not survive it. */
export function useWarnBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

export function buildScenarioFileLater(state: WardFlowState, now: Instant): Promise<ScenarioFileBuild> {
  return import("./ward-flow-scenario-file").then(
    ({ buildScenarioFile }) => buildScenarioFile(state, now, WARD_FLOW_DEMO_STORAGE_VERSION, new Date()),
    () => ({ ok: false, reason: SCENARIO_TOOLS_UNAVAILABLE }),
  );
}

export function readScenarioFileLater(text: string): Promise<ScenarioFileRead> {
  return import("./ward-flow-scenario-file").then(
    ({ readScenarioFile }) => readScenarioFile(text, WARD_FLOW_DEMO_STORAGE_VERSION),
    () => ({ ok: false, reason: SCENARIO_TOOLS_UNAVAILABLE }),
  );
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
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.removeItem(WARD_FLOW_DEMO_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
