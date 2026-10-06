import { describe, expect, it } from "vitest";

import {
  headerCopy,
  initialWorkModeState,
  reduceWorkMode,
  type WorkModeState,
} from "../src/app/mockups/work-mode/state";

function state(partial: Partial<WorkModeState> = {}): WorkModeState {
  return { ...initialWorkModeState, ...partial };
}

describe("reduceWorkMode", () => {
  it("opens More from the fourth tab and keeps the current page", () => {
    const next = reduceWorkMode(state({ tab: 1 }), { type: "tab", index: 3 });
    expect(next.overlay).toBe("more");
    expect(next.tab).toBe(1);
  });

  it("switches tabs and clears a sheet", () => {
    const next = reduceWorkMode(state({ overlay: "more", view: "needs" }), { type: "tab", index: 2 });
    expect(next).toMatchObject({ tab: 2, view: "main", overlay: null, toast: null });
  });

  it("resets the phone when the area changes", () => {
    const next = reduceWorkMode(state({ tab: 2, weekAsMonth: true, view: "needs" }), {
      type: "mode",
      mode: "rost",
      tab: 1,
    });
    expect(next).toMatchObject({ mode: "rost", tab: 1, view: "main", overlay: null, weekAsMonth: false });
  });

  it("opens the month from the week card", () => {
    const next = reduceWorkMode(state(), { type: "weekMonth", month: true });
    expect(next).toMatchObject({ weekAsMonth: true, tab: 1, view: "main", overlay: null });
  });

  it("accepts a swap and undo puts the request back", () => {
    const accepted = reduceWorkMode(state({ overlay: "swap" }), { type: "acceptSwap" });
    expect(accepted).toMatchObject({
      swapAccepted: true,
      mode: "rost",
      tab: 2,
      overlay: null,
      toast: "Swap accepted. Dr Grant approves next.",
    });
    const undone = reduceWorkMode(accepted, { type: "undo" });
    expect(undone.swapAccepted).toBe(false);
    expect(undone.toast).toBeNull();
    expect(undone.mode).toBe("rost");
  });

  it("does not undo a swap after a different notice", () => {
    const accepted = reduceWorkMode(state(), { type: "acceptSwap" });
    const other = reduceWorkMode(accepted, { type: "toast", message: "Something else." });
    expect(reduceWorkMode(other, { type: "undo" }).swapAccepted).toBe(true);
  });

  it("clears a previous answer when search opens again", () => {
    const answered = reduceWorkMode(state(), { type: "answer", answer: "nights", query: "nights" });
    const reopened = reduceWorkMode(answered, { type: "overlay", overlay: "search" });
    expect(reopened.searchQuery).toBe("");
    expect(reopened.searchAnswer).toBeNull();
  });
});

describe("headerCopy", () => {
  it("uses a back control on Needs you", () => {
    expect(headerCopy(state({ view: "needs" })).back).toBe(true);
  });

  it("uses the bell on Admin", () => {
    const copy = headerCopy(state({ mode: "admin" }));
    expect(copy.right).toBe("bell");
    expect(copy.dot).toBe(true);
    expect(copy.title).toBe("Good morning, Josh");
  });

  it("names the month when the week tab is showing October", () => {
    const copy = headerCopy(state({ tab: 1, weekAsMonth: true }));
    expect(copy.title).toBe("This month");
    expect(copy.eyebrow).toBe("October 2026");
  });
});
