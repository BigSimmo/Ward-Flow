import { afterEach, describe, expect, it, vi } from "vitest";
import {
  holdInPlace,
  returnFocusInPlace,
  revealWardOption,
  wardScrollBehavior,
} from "@/components/ward-management/ward-scroll";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-reduced-motion");
  document.body.replaceChildren();
});

describe("Ward scroll preferences", () => {
  it("animates ordinary action scrolling", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(wardScrollBehavior()).toBe("smooth");
  });

  it("immediately reveals content for system or manual reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(wardScrollBehavior()).toBe("instant");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    document.documentElement.setAttribute("data-reduced-motion", "");
    expect(wardScrollBehavior()).toBe("instant");
  });
});

describe("Search option scrolling", () => {
  function fixture(scrollParent: boolean) {
    const popup = document.createElement("div");
    const list = document.createElement("ul");
    list.setAttribute("role", "listbox");
    const option = document.createElement("li");
    option.setAttribute("role", "option");
    list.append(option);
    popup.append(list);
    document.body.append(popup);
    const scroller = scrollParent ? popup : list;
    scroller.style.overflowY = "auto";
    Object.defineProperty(scroller, "clientHeight", { value: 100 });
    vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue({ top: 10, bottom: 110 } as DOMRect);
    const rect = vi.spyOn(option, "getBoundingClientRect");
    return { scroller, option, rect };
  }

  for (const scrollParent of [false, true]) {
    it(`reveals clipped rows in the ${scrollParent ? "popup" : "list"} only`, () => {
      const { scroller, option, rect } = fixture(scrollParent);
      rect.mockReturnValue({ top: 130, bottom: 170 } as DOMRect);
      revealWardOption(option);
      expect(scroller.scrollTop).toBe(60);
      rect.mockReturnValue({ top: -10, bottom: 30 } as DOMRect);
      revealWardOption(option);
      expect(scroller.scrollTop).toBe(40);
      rect.mockReturnValue({ top: 20, bottom: 60 } as DOMRect);
      revealWardOption(option);
      expect(scroller.scrollTop).toBe(40);
      expect(document.documentElement.scrollTop).toBe(0);
    });
  }

  it("does not fall back to scrolling the page when a list has no scrolling surface", () => {
    const { scroller, option } = fixture(false);
    scroller.style.overflowY = "visible";
    expect(() => revealWardOption(option)).not.toThrow();
    expect(scroller.scrollTop).toBe(0);
    expect(() => revealWardOption(null)).not.toThrow();
  });
});

describe("Holding a tapped control in place (Note 7)", () => {
  function runFrames() {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  }

  it("scrolls the work column by the distance the control moved", () => {
    runFrames();
    const scroller = document.createElement("div");
    scroller.setAttribute("data-wf-scroller", "");
    const control = document.createElement("button");
    scroller.append(control);
    document.body.append(scroller);
    scroller.scrollTop = 0;
    let top = 400;
    vi.spyOn(control, "getBoundingClientRect").mockImplementation(() => ({ top }) as DOMRect);
    const spy = vi.spyOn(scroller, "scrollTop", "set");
    // The first frame reads 400; a group unfolds above and the control is now 2,000px lower.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      top = 2400;
      callback(0);
      return 0;
    });
    holdInPlace(control);
    expect(spy).toHaveBeenCalledWith(2000);
  });

  it("returns focus to the opener without scrolling, or to the fallback when the opener is gone", () => {
    runFrames();
    const opener = document.createElement("button");
    const row = document.createElement("button");
    document.body.append(opener, row);
    const focus = vi.spyOn(opener, "focus");
    returnFocusInPlace(opener, () => row);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    opener.remove();
    returnFocusInPlace(opener, () => row);
    expect(document.activeElement).toBe(row);
  });
});
