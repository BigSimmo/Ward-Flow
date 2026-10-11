import { afterEach, describe, expect, it, vi } from "vitest";
import { revealWardOption, wardScrollBehavior } from "@/lib/ward-scroll";

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
