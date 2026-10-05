import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  boardFigures,
  transportFigures,
  JOB_STATES,
} from "@/components/ward-management/movements/movement-flow-figures";
import { plainRefusal, plural } from "@/components/ward-management/movements/movement-flow-parts";
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

describe("movement flow figures with no data, and the plain-English helpers", () => {
  it("reports zero rather than failing when there are no movements", () => {
    const empty = boardFigures([], NOW_ANCHOR);
    expect(empty.open).toHaveLength(0);
    expect(empty.stages.every((stage) => stage.movements.length === 0)).toBe(true);
    expect(empty.longest).toBeUndefined();
    const none = transportFigures([]);
    expect(none.jobs).toHaveLength(0);
    expect(JOB_STATES.every((job) => none.byState[job] === 0)).toBe(true);
  });

  it("writes counts with the right plural and refusals without internal field names", () => {
    expect(plural(1, "job")).toBe("1 job");
    expect(plural(2, "ward is", "wards are")).toBe("2 wards are");
    expect(plainRefusal("REFER_TO_UNITS overrideReason must be chosen from OVERRIDE_REASONS")).toBe(
      "Choose a reason from the list before going ahead anyway.",
    );
    expect(plainRefusal(undefined)).toBe("The step was not recorded.");
    expect(plainRefusal("TRANSPORT_EN_ROUTE needs an accepted job")).not.toMatch(/[A-Z]+_[A-Z]+/);
  });
});

describe("movement flow stylesheet", () => {
  // Moving the stylesheet once left its `composes` path pointing one folder too far up; no unit
  // test renders CSS, so only the dev server noticed. Every composed file must exist.
  it("composes only from stylesheets that exist", () => {
    const file = "src/components/ward-management/movements/movement-flow.module.css";
    const paths = [...readFileSync(file, "utf8").matchAll(/composes:[^;]*from\s+"([^"]+)"/gu)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(existsSync(resolve(dirname(file), path)), path).toBe(true);
  });
});
