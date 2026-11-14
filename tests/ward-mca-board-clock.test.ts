// L1 (mechanics and clock audit, 14 Nov 2026): the signed-in board clock between polls counts from
// the server's own time in its last answer, so it turns the minute when the server does, and never
// shows a minute earlier than it already showed, even after a slow first answer following an outage.
import { describe, expect, it } from "vitest";
import {
  anchorSharedBoard,
  anchoredBoardNow,
  sharedBoardNow,
  type SharedBoardAnchor,
} from "@/components/ward-management/ward-shared-clock";

// Day 0 on a whole minute; no demo offset. The server's board minute is whole minutes since day 0.
const DAY_ZERO = "2026-11-10T00:00:00Z";
const DAY_ZERO_MS = Date.parse(DAY_ZERO);
const serverMinute = (ms: number) => Math.floor((ms - DAY_ZERO_MS) / 60_000);
const answer = (sampledAt: number, generation = 1) => ({
  now: serverMinute(sampledAt),
  payload: { dayZero: DAY_ZERO, state: { clockOffsetMinutes: 0, worldGeneration: generation } },
});
// Server and device clocks agree here: only intervals matter, and they are what the anchor uses.
let seed = 7;
const random = () => {
  seed = (seed * 16_807) % 2_147_483_647;
  return seed / 2_147_483_647;
};

describe("shared board clock (L1)", () => {
  it("turns the minute with the server once the answer's travel time has passed, while polls fail", () => {
    let behind = 0;
    let checks = 0;
    for (let trial = 0; trial < 500; trial++) {
      const sampled = DAY_ZERO_MS + 36_000_000 + Math.floor(random() * 60_000_000);
      const travel = 50 + Math.floor(random() * 400);
      const received = sampled + travel;
      const anchor = anchorSharedBoard(undefined, answer(sampled), received, sampled);
      // The provider's tick lands at the anchor's own minute turns (`useWardMinuteTick` phase).
      const phase = anchor.at - anchor.ms;
      for (let k = 1; k <= 10; k++) {
        const tick = phase + k * 60_000;
        checks++;
        if (anchoredBoardNow(anchor, tick) !== serverMinute(tick - travel)) behind++;
        // Never ahead of the server.
        expect(anchoredBoardNow(anchor, tick)).toBeLessThanOrEqual(serverMinute(tick));
      }
    }
    expect(checks).toBe(5_000);
    expect(behind).toBe(0);
  });

  it("never moves back a minute on the first answer after an outage", () => {
    let backwards = 0;
    for (let trial = 0; trial < 20_000; trial++) {
      const first = DAY_ZERO_MS + 36_000_000 + Math.floor(random() * 60_000_000);
      const quick = 80 + Math.floor(random() * 120);
      const before = anchorSharedBoard(undefined, answer(first), first + quick, first);
      const back = first + quick + 60_000 + Math.floor(random() * 600_000);
      const slow = 500 + Math.floor(random() * 4_500);
      const shownBefore = anchoredBoardNow(before, back - 1);
      // An answer sampled `slow` ms before it arrived, and one with no server time (a save's reply).
      for (const serverTime of [back - slow, undefined]) {
        const after = anchorSharedBoard(before, answer(back - slow), back, serverTime);
        if (anchoredBoardNow(after, back) < shownBefore) backwards++;
      }
    }
    expect(backwards).toBe(0);
  });

  it("follows a new world (Reset) and a moved clock (+15) at once", () => {
    const sampled = DAY_ZERO_MS + 40_000_000;
    const first = anchorSharedBoard(undefined, answer(sampled), sampled + 100, sampled);
    const advanced = { ...answer(sampled + 1_000), now: serverMinute(sampled) + 15 };
    expect(
      anchoredBoardNow(anchorSharedBoard(first, advanced, sampled + 1_100, sampled + 1_000), sampled + 1_100),
    ).toBe(serverMinute(sampled) + 15);
    // A new world may start earlier: it is not held to the old world's minute.
    const reset = { ...answer(sampled + 2_000, 2), now: serverMinute(sampled) - 240 };
    const anchored: SharedBoardAnchor = anchorSharedBoard(first, reset, sampled + 2_100, sampled + 2_000);
    expect(anchoredBoardNow(anchored, sampled + 2_100)).toBe(serverMinute(sampled) - 240);
  });

  it("reads as before for an answer with no anchor (older server)", () => {
    expect(sharedBoardNow(900, 1_000, 61_000)).toBe(901);
    expect(sharedBoardNow(900, 1_000, 1_000 - 3_600_000)).toBe(900);
    expect(sharedBoardNow(900, 1_000, 31_000, 30_000)).toBe(901);
  });
});
