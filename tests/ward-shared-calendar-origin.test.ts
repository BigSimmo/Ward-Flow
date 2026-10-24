import { describe, expect, it } from "vitest";
import { applyCommand, scopeWorld, seedWorld, validWorld } from "../backend/ward-flow/engine";
import {
  calendarDateOf,
  demoDayZero,
  formatSheetMoment,
  perthDateTimeLocal,
} from "../src/components/ward-management/ward-clock";

describe("shared Perth calendar origin", () => {
  it.each([
    ["2026-10-20T15:59:00Z", "2026-10-19T16:00:00.000Z", "2026-10-20T10:42", "Tue, 20 Oct, 10:42"],
    ["2026-10-20T16:00:00Z", "2026-10-20T16:00:00.000Z", "2026-10-21T10:42", "Wed, 21 Oct, 10:42"],
    ["2026-10-20T18:00:00Z", "2026-10-20T16:00:00.000Z", "2026-10-21T10:42", "Wed, 21 Oct, 10:42"],
  ])("agrees with the local calendar for a session opened at %s", (openedAt, origin, typed, label) => {
    const at = new Date(openedAt);
    const world = seedWorld(at);
    const sharedZero = new Date(world.dayZero);
    const localZero = demoDayZero(at);
    expect(world.dayZero).toBe(origin);
    expect(sharedZero.getTime()).toBe(localZero.getTime());
    expect(formatSheetMoment(642, sharedZero)).toBe(label);
    const typedDate = perthDateTimeLocal(typed)!;
    const typedInstant = (typedDate.getTime() - sharedZero.getTime()) / 60_000;
    expect(typedInstant).toBe(642);
    expect(calendarDateOf(typedInstant, sharedZero)).toEqual(typedDate);
  });

  it("preserves the stored origin of existing shared worlds on reads and saves", () => {
    const at = new Date("2026-10-20T18:00:00Z");
    // Existing UTC-midnight origins remain authoritative: changing them would reinterpret records.
    const world = { ...seedWorld(at), dayZero: "2026-10-20T00:00:00.000Z" };
    expect(validWorld(world)).toBe(true);
    const scoped = scopeWorld(world, { role: "coordinator", scope: { kind: "statewide" } }, at);
    expect(scoped.dayZero).toBe(world.dayZero);
    const saved = applyCommand(
      world,
      {
        type: "REQUEST_CAPACITY_REFRESH",
        role: "coordinator",
        unitId: world.state.units[0]!.id,
      },
      at,
    );
    expect(saved.outcome).toBe("accepted");
    expect(saved.world.dayZero).toBe(world.dayZero);
  });
});
