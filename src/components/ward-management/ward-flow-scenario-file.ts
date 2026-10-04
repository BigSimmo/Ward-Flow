import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "./ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * SAVE AND LOAD A DEMO SCENARIO AS A FILE (Josh, 4 October 2026, open-items list item 2).
 *
 * Browser saving stops once anyone types free text (D-18), so a rehearsed demo could not survive a
 * refresh. This is the explicit alternative: the presenter downloads the whole synthetic world to a
 * file and loads it back later, on any day, without a backend.
 *
 * 🔴 **D-18 STILL HOLDS.** Nothing here writes to browser storage. A file is a deliberate download
 * the presenter asked for, and a LOADED world is treated as carrying typed text, so the provider
 * keeps it in memory only — a refresh discards it and the presenter loads the file again.
 *
 * The load path reuses `isValidStoredWardFlowState`, the same fence that guards a browser restore,
 * so a file can never put a shape into the reducer that a browser restore would refuse. Two
 * consequences follow and are stated rather than hidden:
 *   - Refusal records are never saved (`rejections: []`, as D-18 does for the browser copy).
 *   - A world holding a repatriation (a typed CAD number) cannot be saved: the shared fence refuses
 *     any stored repatriation, and quietly dropping one would make the file lie about the day.
 */

export const WARD_FLOW_SCENARIO_FILE_FORMAT = "ward-flow-demo-scenario";
/** Bump only when the FILE's envelope changes. The world's own shape is versioned separately by the
 *  `stateVersion` the provider passes in (its browser-storage version), and both must match. */
export const WARD_FLOW_SCENARIO_FILE_VERSION = 1;
/** Generous for a synthetic world (a seeded day is well under 1 MB) and small enough that a wrong
 *  file picked by mistake is refused before it is parsed. */
export const WARD_FLOW_SCENARIO_FILE_MAX_BYTES = 10 * 1024 * 1024;

type ScenarioFile = {
  format: typeof WARD_FLOW_SCENARIO_FILE_FORMAT;
  version: number;
  stateVersion: number;
  notice: string;
  savedAt: string;
  now: Instant;
  state: WardFlowState;
};

export type ScenarioFileBuild = { ok: true; json: string; fileName: string } | { ok: false; reason: string };
export type ScenarioFileRead = { ok: true; state: WardFlowState; now: Instant } | { ok: false; reason: string };

const NOT_A_SCENARIO = "This file is not a Ward Flow demo scenario.";
const WRONG_VERSION = "This scenario was saved by a different version of Ward Flow and cannot be loaded safely.";
const DAMAGED = "This scenario file is damaged or incomplete, so nothing was loaded.";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildScenarioFile(
  state: WardFlowState,
  now: Instant,
  stateVersion: number,
  savedAt: Date,
): ScenarioFileBuild {
  if (state.repatriations.length > 0)
    return {
      ok: false,
      reason: "This scenario includes a repatriation, which cannot be saved to a file yet. Nothing was saved.",
    };
  const file: ScenarioFile = {
    format: WARD_FLOW_SCENARIO_FILE_FORMAT,
    version: WARD_FLOW_SCENARIO_FILE_VERSION,
    stateVersion,
    notice: "Synthetic demonstration data only. Not a clinical record.",
    savedAt: savedAt.toISOString(),
    now,
    // Refusals are never saved (D-18): a refusal can quote a caller-supplied id back.
    state: { ...state, rejections: [] },
  };
  const json = JSON.stringify(file, null, 2);
  // Checked on the way OUT as well as in, on exactly what will be written (JSON drops `undefined`
  // fields, which the fence would otherwise refuse): a file this build cannot load back is worse
  // than none.
  if (readScenarioFile(json, stateVersion).ok !== true)
    return { ok: false, reason: "This scenario could not be saved safely. Nothing was saved." };
  const stamp = `${savedAt.getFullYear()}-${pad(savedAt.getMonth() + 1)}-${pad(savedAt.getDate())}-${pad(savedAt.getHours())}${pad(savedAt.getMinutes())}`;
  return { ok: true, json, fileName: `ward-flow-scenario-${stamp}.json` };
}

/**
 * Reads a file back. Nothing is repaired or mixed with fixture data: anything short of a clean,
 * same-version world is refused, and the refusal never quotes the file's own content.
 */
export function readScenarioFile(text: string, stateVersion: number): ScenarioFileRead {
  if (text.length > WARD_FLOW_SCENARIO_FILE_MAX_BYTES) return { ok: false, reason: NOT_A_SCENARIO };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: NOT_A_SCENARIO };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return { ok: false, reason: NOT_A_SCENARIO };
  const file = parsed as Record<string, unknown>;
  if (file.format !== WARD_FLOW_SCENARIO_FILE_FORMAT) return { ok: false, reason: NOT_A_SCENARIO };
  if (file.version !== WARD_FLOW_SCENARIO_FILE_VERSION || file.stateVersion !== stateVersion)
    return { ok: false, reason: WRONG_VERSION };
  const now = file.now;
  if (typeof now !== "number" || !Number.isFinite(now) || !isValidStoredWardFlowState(file.state))
    return { ok: false, reason: DAMAGED };
  const state = file.state;
  if (
    now < NOW_ANCHOR + state.clockOffsetMinutes ||
    state.auditEvents.some((event) => event.at !== null && event.at > now)
  )
    return { ok: false, reason: DAMAGED };
  return { ok: true, state, now };
}
