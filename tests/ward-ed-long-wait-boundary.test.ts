// C3 (Josh, 11 Nov 2026): one long-wait boundary. Exactly 24 hours counts as a long wait on the ED
// screen, as it already did on Alerts, the TV, the bed meeting and Statistics (`>=`, not `>`).
import { describe, expect, it } from "vitest";

import { deriveEdScreen } from "@/components/ward-management/ed/ed-screen-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isLongWait, LONG_WAIT_MINUTES, LONG_WAIT_TEXT } from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const noop = () => undefined;

function board(state: WardFlowState, edId: string) {
  return deriveEdScreen({
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    registryPatients: state.patients,
    configuration: state.configuration,
    inboxSnoozes: state.inboxSnoozes,
    admissions: state.admissions,
    now: NOW,
    accessTarget: state.configuration.edAccessTargetMinutes,
    thisEdId: edId,
    boardFilter: "all",
    patientQuery: "",
    patientSort: "current",
    heroHighlight: null,
    selectedPatientId: null,
    arrivalPlanOpenFor: undefined,
    setSelectedPatientId: noop,
    setPhoneSheetFor: noop,
    setArrivalPlanOpenFor: noop,
    toggleBookTransport: noop,
    recordEdStep: noop,
  });
}

/** A seeded person waiting in an ED, opened `waited` minutes before now. */
function waitingFor(waited: number) {
  const seed = seedWardFlowState();
  const journey = seed.movements.find((movement) => movement.originEdId !== undefined && isWaitingInEd(movement));
  if (!journey?.originEdId) throw new Error("the seed has nobody waiting in an ED");
  const state = {
    ...seed,
    movements: seed.movements.map((movement) =>
      movement.id === journey.id ? { ...movement, openedAt: NOW - waited } : movement,
    ),
  };
  const view = board(state, journey.originEdId);
  return {
    flagged: view.needsYouItems.some(
      (item) => item.key.startsWith(`${journey.id}-`) && item.kind === `Waiting ${LONG_WAIT_TEXT}`,
    ),
    timelineTone: view.timelineEvents.find((event) => event.id === `arrival-${journey.id}-${NOW - waited}`)?.tone,
  };
}

describe("long-wait boundary", () => {
  it("counts exactly 24 hours as a long wait, and one minute less as not", () => {
    expect(LONG_WAIT_MINUTES).toBe(24 * 60);
    expect(isLongWait(LONG_WAIT_MINUTES)).toBe(true);
    expect(isLongWait(LONG_WAIT_MINUTES - 1)).toBe(false);
    expect(isLongWait(LONG_WAIT_MINUTES + 1)).toBe(true);
  });

  it("flags a person on the ED screen and its timeline at exactly 24 hours", () => {
    const at = waitingFor(LONG_WAIT_MINUTES);
    expect(at.flagged).toBe(true);
    expect(at.timelineTone).toBe("warn");
    const before = waitingFor(LONG_WAIT_MINUTES - 1);
    expect(before.flagged).toBe(false);
    expect(before.timelineTone).toBe("quiet");
  });
});
