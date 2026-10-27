import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  RESTORED_NOTICE_PREFIX,
  STORAGE_UNAVAILABLE,
  WARD_FLOW_DEMO_STORAGE_KEY,
  WARD_FLOW_STORED_STATE_VERSION as WARD_FLOW_DEMO_STORAGE_VERSION,
} from "./ward-flow-demo-storage-constants";
import { demoSaveIsCurrent } from "./ward-flow-demo-save-marker";
import type { DemoRead, WardFlowDemoPayload } from "./ward-flow-demo-storage";
import {
  isValidStoredWardFlowState,
  migrateStoredWardFlowState,
  withInboxStreamADefaults,
} from "./ward-flow-storage-validation";

/**
 * The guarded read of the demonstration's saved session (`ward-flow-demo-storage.ts` has its shape
 * and the write). Loaded on demand through `readDemoStateLater`, never imported by a page directly:
 * it brings in the stored-state schema (Josh, 21 Oct 2026: no phone script budget raises).
 */

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

const SAVE_FROM_EARLIER_DAY =
  "The saved demonstration was from an earlier day, so a fresh synthetic demonstration has started for today.";

const SAVE_REJECTED =
  "The saved demonstration could not be restored safely. A fresh synthetic demonstration has started.";

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
    // A2-15 (21 Oct 2026): a save from an earlier calendar day (a reload after midnight) is not
    // damaged, so it says why it was not restored rather than the generic refusal.
    if (
      isValidDemoPayload(parsed) &&
      parsed.version === WARD_FLOW_DEMO_STORAGE_VERSION &&
      parsed.dayZero < dayZero.getTime()
    )
      return { recoveryNotice: SAVE_FROM_EARLIER_DAY };
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
    // DA-27 (overall review, 20 Oct 2026): the notice names the save by the board's own clock, the
    // time shown beside it in the header, never the device's real time, which read as a different
    // day and hour next to a demo clock. The board resumes at the save plus the real minutes since,
    // so a save from the board's previous day says so.
    const resumedAt = parsed.now + (mountedAtAbsolute - parsed.savedAtAbsolute);
    const saved = { ...parsed, state: withInboxStreamADefaults(parsed.state) };
    // WS-13 (workflow speed audit, 26 Oct 2026): an ordinary reload of a save that is still the
    // session's latest restores quietly. The notice stays for a save that a later failed write left.
    const restoredFrom = `${RESTORED_NOTICE_PREFIX} ${formatInstantWithDay(parsed.now, resumedAt)} on the board clock.`;
    // CS3-17 still speaks when that quiet restore closed something opened before it loaded.
    if (demoSaveIsCurrent()) return { saved, quietRecoveryNotice: restoredFrom };
    return { saved, recoveryNotice: `${restoredFrom} Later changes may not have been saved.` };
  } catch {
    // Do not repeat stored content or an exception message in the recovery notice.
    return { recoveryNotice: STORAGE_UNAVAILABLE };
  }
}
