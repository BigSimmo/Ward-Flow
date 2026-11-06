import { describe, expect, it } from "vitest";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  createRepeatTapGuard,
  REPEAT_TAP_WINDOW_MS,
  repeatTapKey,
} from "../src/components/ward-management/ward-repeat-tap-guard";
import type { WardCommandOutcome } from "../src/components/ward-management/ward-shared-client";

// Tier 1 item 2 (Josh, 4 Nov 2026): a double tap records once.
const book = (now: number) =>
  ({ type: "BOOK_TRANSPORT", role: "coordinator", now, movementId: "mv-1" }) as unknown as WardFlowEvent;

function counter(status: WardCommandOutcome["status"] = "accepted") {
  let calls = 0;
  const run = () => ({ commandId: `c-${++calls}`, status }) as WardCommandOutcome;
  return { run, calls: () => calls };
}

describe("repeat tap guard", () => {
  it("records a double tap once and gives the second tap the first one's answer", () => {
    let clock = 1000;
    const guard = createRepeatTapGuard(() => clock);
    const { run, calls } = counter();
    const first = guard(book(1000), run);
    clock += 300;
    const second = guard(book(1300), run);
    expect(calls()).toBe(1);
    expect(second).toBe(first);
  });

  it("records the same action again once the window has passed", () => {
    let clock = 0;
    const guard = createRepeatTapGuard(() => clock);
    const { run, calls } = counter();
    guard(book(0), run);
    clock = REPEAT_TAP_WINDOW_MS;
    guard(book(clock), run);
    expect(calls()).toBe(2);
  });

  it("records a different action straight away", () => {
    const guard = createRepeatTapGuard(() => 0);
    const { run, calls } = counter();
    guard(book(0), run);
    guard({ ...book(0), movementId: "mv-2" } as WardFlowEvent, run);
    expect(calls()).toBe(2);
  });

  it("lets a refused first tap be tried again at once", async () => {
    const guard = createRepeatTapGuard(() => 0);
    let calls = 0;
    const run = () => Promise.resolve({ commandId: `c-${++calls}`, status: "refused" } as WardCommandOutcome);
    await guard(book(0), run);
    await guard(book(0), run);
    expect(calls).toBe(2);
  });

  it("joins a press of the same action to a save still waiting offline, until that save settles (4 Nov audit)", async () => {
    let clock = 0;
    const guard = createRepeatTapGuard(() => clock);
    let confirm: (outcome: WardCommandOutcome) => void = () => undefined;
    const confirmation = new Promise<WardCommandOutcome>((resolve) => (confirm = resolve));
    let calls = 0;
    const run = () => {
      calls += 1;
      return Promise.resolve({
        commandId: `c-${calls}`,
        status: "failed",
        message: "You're offline. This change is waiting on this page.",
        confirmation,
      } as WardCommandOutcome);
    };
    const first = await guard(book(0), run);
    clock = 60_000;
    const again = await guard(book(clock), run);
    expect(calls).toBe(1);
    expect(again?.commandId).toBe(first?.commandId);
    // A different action is not held back.
    await guard({ ...book(clock), movementId: "mv-2" } as WardFlowEvent, run);
    expect(calls).toBe(2);
    confirm({ commandId: "c-1", status: "accepted" });
    await confirmation;
    await Promise.resolve();
    clock = 120_000;
    await guard(book(clock), run);
    expect(calls).toBe(3);
  });

  it("lets the same action go again once its waiting save is from an earlier workspace", async () => {
    const guard = createRepeatTapGuard(() => 0);
    let current = true;
    let calls = 0;
    const run = () => {
      calls += 1;
      return Promise.resolve({
        commandId: `c-${calls}`,
        status: "failed",
        confirmation: new Promise<WardCommandOutcome>(() => undefined),
        isCurrent: () => current,
      } as WardCommandOutcome);
    };
    await guard(book(0), run);
    current = false;
    await guard(book(0), run);
    expect(calls).toBe(2);
  });

  it("never holds back the demo clock's step forward", () => {
    const event = { type: "ADVANCE_CLOCK", role: "demo", now: 0, minutes: 15 } as WardFlowEvent;
    expect(repeatTapKey(event)).toBeNull();
    const guard = createRepeatTapGuard(() => 0);
    const { run, calls } = counter();
    guard(event, run);
    guard(event, run);
    expect(calls()).toBe(2);
  });
});
