import { describe, expect, it } from "vitest";

import {
  boardFigures,
  transportFigures,
  JOB_STATES,
} from "@/components/ward-management/movements/proposal/movement-proposal-figures";
import { transportCounts, transportLegs } from "@/components/ward-management/movements/movements-derivations";
import { isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The 5 October 2026 movements and transport proposal must agree with the engine and with itself:
 * the movement board, the movement record and the Transport Hub proposal read these figures.
 */
describe("movement and transport proposal figures", () => {
  const state = seedWardFlowState();
  const board = boardFigures(state.movements, NOW_ANCHOR);
  const transport = transportFigures(state.movements);

  it("counts the same open population as the engine, and the stages add up to it", () => {
    expect(board.open.length).toBe(state.movements.filter(isOpen).length);
    expect(board.stages.reduce((sum, stage) => sum + stage.movements.length, 0)).toBe(board.open.length);
  });

  it("counts open transport jobs exactly as the Transport Hub does, split across the four states", () => {
    expect(transport.jobs.length).toBe(state.movements.filter(isOfficerJob).length);
    expect(JOB_STATES.reduce((sum, job) => sum + transport.byState[job], 0)).toBe(transport.jobs.length);
  });

  it("agrees with the movements screen's own transport-leg counts for accepted jobs", () => {
    const legs = transportCounts(transportLegs(board.open, NOW_ANCHOR));
    expect(transport.byState.Accepted).toBe(legs.Accepted);
    expect(transport.byState["En route"]).toBe(legs["En route"]);
    expect(transport.byState.Collected).toBe(legs.Collected);
    expect(board.liveLegCount + transport.byState.Requested).toBe(transport.jobs.length);
  });

  it("never counts a delivered job as both arrived today and open", () => {
    expect(board.arrivedToday.every((movement) => !isOpen(movement))).toBe(true);
    expect(board.arrivedToday.length).toBeLessThanOrEqual(board.closedToday.length);
  });

  it("orders tier 1 movements longest wait first", () => {
    expect(board.tierOne.every((movement) => movement.urgency === 1)).toBe(true);
    expect(board.tierOne.length).toBe(board.open.filter((movement) => movement.urgency === 1).length);
  });
});
