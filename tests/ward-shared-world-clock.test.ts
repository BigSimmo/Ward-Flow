/** @vitest-environment node */
// D-150 (Josh, 11 Nov 2026): the signed-in site runs on real Perth time. The shared world's clock is
// the real minutes since its day zero, not the scripted 10:42 the public demo starts from.
import { describe, expect, it } from "vitest";
import { seedWorld, worldNow } from "../backend/ward-flow/engine";
import { demoDayZero } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/** A real moment at Perth hour:minute on 11 Nov 2026 (AWST is UTC+8). */
const perth = (hour: number, minute: number) => new Date(Date.UTC(2026, 10, 11, hour - 8, minute));

describe("shared world clock (D-150)", () => {
  it("reads the real Perth time for a new world, whatever hour it was made", () => {
    for (const [hour, minute] of [
      [9, 54],
      [10, 42],
      [17, 5],
    ] as const) {
      const at = perth(hour, minute);
      expect(worldNow(seedWorld(at), at)).toBe(hour * 60 + minute);
    }
  });

  it("keeps an existing world on its stored day zero and counts real minutes from it", () => {
    const madeAt = perth(9, 54);
    const world = seedWorld(madeAt);
    // The live audit's case: a world made at 9:54 used to read 10:42 at once, 48 minutes fast.
    const later = new Date(madeAt.getTime() + 25 * 24 * 60 * 60_000 + 129 * 60_000);
    expect(worldNow(world, later)).toBe(25 * 1440 + 12 * 60 + 3);
    expect(world.dayZero).toBe(demoDayZero(madeAt).toISOString());
  });

  it("re-anchors the seed onto the real time, keeping every relative offset", () => {
    const at = perth(17, 5);
    const world = seedWorld(at);
    const shift = 17 * 60 + 5 - NOW_ANCHOR;
    const authored = seedWardFlowState();
    const firstAuthored = authored.movements.find((movement) => typeof movement.openedAt === "number")!;
    const firstSeeded = world.state.movements.find((movement) => movement.id === firstAuthored.id)!;
    expect(firstSeeded.openedAt).toBe(firstAuthored.openedAt + shift);
  });

  it("still adds a clock offset already in a stored world", () => {
    const at = perth(12, 0);
    const world = seedWorld(at);
    expect(worldNow({ ...world, state: { ...world.state, clockOffsetMinutes: 15 } }, at)).toBe(12 * 60 + 15);
  });
});
