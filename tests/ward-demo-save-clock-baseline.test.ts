import { describe, expect, it } from "vitest";

import { deviceSaveUnchanged } from "@/components/ward-management/ward-flow-demo-storage";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

// D-229: Resume moves only the clock's elapsed baseline, and that must still be saved, or a reload
// would count the paused minutes as time passed.
describe("device save after Resume", () => {
  const state = seedWardFlowState();
  const held = { typedTextSeen: false };
  const dayZero = new Date(0);
  const inputs = (clockBaseline: number) => ({
    state,
    held,
    locked: false,
    dayZero,
    mountedAtAbsolute: 100,
    clockBaseline,
  });

  it("writes again when only the clock baseline moved", () => {
    expect(deviceSaveUnchanged(inputs(0), inputs(-20))).toBe(false);
  });

  it("still skips a save that would store the same world and clock", () => {
    expect(deviceSaveUnchanged(inputs(-20), inputs(-20))).toBe(true);
  });
});
