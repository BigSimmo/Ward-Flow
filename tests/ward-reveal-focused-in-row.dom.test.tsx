import { afterEach, describe, expect, it, vi } from "vitest";

import { revealFocusedInRow } from "@/components/ward-management/shell/use-reveal-focused-in-row";

/**
 * H-0386 (26 Oct 2026): Tab left a chip half cut off at the edge of a sideways row, because a browser
 * only scrolls a focused control that shows none of itself. Keyboard focus now brings it fully in.
 */
function row(chipLeft: number, chipRight: number, keyboard = true) {
  const scroller = document.createElement("div");
  scroller.style.overflowX = "auto";
  Object.defineProperty(scroller, "scrollWidth", { value: 640 });
  Object.defineProperty(scroller, "clientWidth", { value: 390 });
  scroller.getBoundingClientRect = () => ({ left: 0, right: 390 }) as DOMRect;
  const chip = document.createElement("button");
  chip.getBoundingClientRect = () => ({ left: chipLeft, right: chipRight }) as DOMRect;
  vi.spyOn(chip, "matches").mockImplementation((selector: string) => selector === ":focus-visible" && keyboard);
  chip.scrollIntoView = vi.fn();
  scroller.append(chip);
  document.body.append(scroller);
  return chip;
}

function focusIn(chip: HTMLElement) {
  const event = new FocusEvent("focusin");
  Object.defineProperty(event, "target", { value: chip });
  revealFocusedInRow(event);
  return chip.scrollIntoView as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a keyboard-focused chip in a sideways row", () => {
  it("scrolls fully into view when part of it is cut off", () => {
    expect(focusIn(row(350, 436))).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  });

  it("is left alone when it already shows in full", () => {
    expect(focusIn(row(120, 200))).not.toHaveBeenCalled();
  });

  it("is left alone on a tap, so the target never moves under a finger", () => {
    expect(focusIn(row(350, 436, false))).not.toHaveBeenCalled();
  });
});
