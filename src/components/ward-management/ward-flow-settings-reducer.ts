import { finiteInstant, type AuditDecision } from "./ward-audit";
import { describeInvalidConfiguration, validateConfiguration } from "./ward-configuration";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { WARD_SCENARIOS, type WardScenario } from "./ward-scenarios";

type SettingsEvent = Extract<
  WardFlowEvent,
  { type: "RESET_SCENARIO" | "SET_SCENARIO" | "ADVANCE_CLOCK" | "SET_CONFIGURATION" }
>;
type SettingsOperations = {
  seedAnchor: number;
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  seed: (offsetMinutes: number, scenario?: WardScenario) => WardFlowState;
};

/** Permission, generation and audit guards run at the main reducer entry point.
 * These handlers retain the supplied decision and apply one settings command. */
export function reduceSettingsEvent(
  state: WardFlowState,
  event: SettingsEvent,
  decision: AuditDecision,
  operations: SettingsOperations,
): WardFlowState {
  switch (event.type) {
    case "RESET_SCENARIO":
      return resetScenario(state, event, operations);
    case "SET_SCENARIO":
      return setScenario(state, event, decision, operations);
    case "ADVANCE_CLOCK":
      return advanceClock(state, event, operations);
    case "SET_CONFIGURATION":
      return setConfiguration(state, event, decision, operations);
  }
}
function resetScenario(
  state: WardFlowState,
  event: Extract<SettingsEvent, { type: "RESET_SCENARIO" }>,
  operations: SettingsOperations,
): WardFlowState {
  return operations.seed(event.now - state.clockOffsetMinutes - operations.seedAnchor);
}

function setScenario(
  state: WardFlowState,
  event: Extract<SettingsEvent, { type: "SET_SCENARIO" }>,
  decision: AuditDecision,
  operations: SettingsOperations,
): WardFlowState {
  // Y4 privacy fix round 2, P3 finding 6: `event.scenario` used to be passed straight through
  // with no runtime check at all — trusted on `WardScenario`'s type alone, the same
  // "union-typed (compile-time only)" gap this codebase already names for `legalStatus` /
  // `waitingOn` / `to` elsewhere (see `ward-flow-persistence-classification.ts`'s own comment).
  // A caller off the type system (an untyped script, a malformed dispatch) could store any
  // string as `state.scenario`, and `isValidStoredWardFlowState` (`ward-flow-provider.tsx`) used
  // to restore it unchecked too. Membership-checked here against the same `WARD_SCENARIOS` list
  // the restore-side check now reads, so the two can never silently disagree about what counts
  // as a real scenario.
  if (!WARD_SCENARIOS.includes(event.scenario)) {
    decision.reasonCode = "invalid-payload";
    return operations.reject(state, event, `SET_SCENARIO scenario must be chosen from WARD_SCENARIOS`);
  }

  return operations.seed(event.now - state.clockOffsetMinutes - operations.seedAnchor, event.scenario);
}

function advanceClock(
  state: WardFlowState,
  event: Extract<SettingsEvent, { type: "ADVANCE_CLOCK" }>,
  operations: SettingsOperations,
): WardFlowState {
  // Audit follow-up 2026-09-25: `event.minutes` used to be added to the offset unchecked,
  // so a non-finite (NaN/Infinity) or negative amount would corrupt every downstream
  // deadline read off the clock. `finiteInstant` already does the finiteness check this
  // reducer uses everywhere else; reused here rather than duplicating it.
  if (finiteInstant(event.minutes) === null || event.minutes < 0) {
    return operations.reject(state, event, "ADVANCE_CLOCK minutes must be a finite, non-negative number");
  }

  return { ...state, clockOffsetMinutes: state.clockOffsetMinutes + event.minutes };
}

function setConfiguration(
  state: WardFlowState,
  event: Extract<SettingsEvent, { type: "SET_CONFIGURATION" }>,
  decision: AuditDecision,
  operations: SettingsOperations,
): WardFlowState {
  const requested = validateConfiguration(event.payload);

  if (!requested) {
    decision.reasonCode = "invalid-payload";
    return operations.reject(state, event, describeInvalidConfiguration(event.payload));
  }

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return { ...state, configuration: requested };
}
