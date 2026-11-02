// Accessibility check A3 and A4 (2 Nov 2026): Tab stays inside a pop-up that manages its own chrome,
// and closing a panel gives focus back to what opened it, found again by id when the list was redrawn.
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { cycleTabWithin, focusIsLost, rememberOpener, returnFocusToOpener } from "@/components/wf/focus-return";

function button(testId: string, parent: HTMLElement = document.body) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("data-testid", testId);
  element.textContent = testId;
  parent.append(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("returnFocusToOpener", () => {
  it("focuses the opener while it is still on the page", () => {
    const opener = button("ward-referral-board-card-select-r1");
    const memo = rememberOpener(opener);
    button("elsewhere").focus();
    expect(returnFocusToOpener(memo)).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it("finds a redrawn row again by its test id when the original has gone", () => {
    const opener = button("ward-referral-board-card-select-r2");
    const memo = rememberOpener(opener);
    opener.remove();
    expect(focusIsLost()).toBe(true);
    const redrawn = button("ward-referral-board-card-select-r2");
    expect(returnFocusToOpener(memo)).toBe(true);
    expect(document.activeElement).toBe(redrawn);
  });

  it("skips a copy that refuses focus and takes the next one with the same id", () => {
    const hidden = button("ward-referral-board-row-r3");
    hidden.disabled = true;
    const memo = rememberOpener(hidden);
    const shown = button("ward-referral-board-row-r3");
    expect(returnFocusToOpener(memo)).toBe(true);
    expect(document.activeElement).toBe(shown);
  });

  it("does nothing when there is no opener to go back to", () => {
    expect(returnFocusToOpener(null)).toBe(false);
    expect(returnFocusToOpener(rememberOpener(null))).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});

describe("cycleTabWithin", () => {
  function panel() {
    const root = document.createElement("div");
    document.body.append(root);
    const first = button("first", root);
    const middle = button("middle", root);
    const last = button("last", root);
    const outside = button("outside");
    return { root, first, middle, last, outside };
  }

  it("wraps Tab from the last control to the first, and Shift+Tab back", () => {
    const { root, first, last } = panel();
    last.focus();
    const forward = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    expect(cycleTabWithin(forward, root, false)).toBe(true);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    const back = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true });
    expect(cycleTabWithin(back, root, false)).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("brings focus that has left the panel back to its first control", () => {
    const { root, first, outside } = panel();
    outside.focus();
    cycleTabWithin(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }), root, false);
    expect(document.activeElement).toBe(first);
  });

  it("leaves other keys alone", () => {
    const { root, middle } = panel();
    middle.focus();
    const key = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true });
    expect(cycleTabWithin(key, root, false)).toBe(false);
    expect(key.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(middle);
  });
});
