import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMobileKeyboard } from "@/components/ward-management/shell/use-mobile-keyboard";

// F-07: iOS Safari lays the keyboard over the page, so the phone shell reads the visual viewport
// and marks <html> for CSS to hide the dock and lift pinned footers.

class FakeVisualViewport extends EventTarget {
  width = 390;
  height = 844;
}

let viewport: FakeVisualViewport;

beforeEach(() => {
  viewport = new FakeVisualViewport();
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerHeight", 844);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("max-width"), media: query })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  delete document.documentElement.dataset.wfKeyboard;
  document.documentElement.style.removeProperty("--keyboard-height");
});

function focusField() {
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  return input;
}

describe("useMobileKeyboard", () => {
  it("marks the page and sets the lift while a focused field has the keyboard up", () => {
    const { result } = renderHook(() => useMobileKeyboard());
    expect(document.documentElement.dataset.wfKeyboard).toBeUndefined();

    act(() => {
      focusField();
      window.dispatchEvent(new Event("focusin"));
      viewport.height = 500;
      viewport.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toEqual({ isKeyboardOpen: true, keyboardHeight: 344 });
    expect(document.documentElement.dataset.wfKeyboard).toBe("open");
    expect(document.documentElement.style.getPropertyValue("--keyboard-height")).toBe("344px");
  });

  it("clears the mark when the field loses focus", () => {
    renderHook(() => useMobileKeyboard());
    const input = focusField();

    act(() => {
      window.dispatchEvent(new Event("focusin"));
      viewport.height = 500;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(document.documentElement.dataset.wfKeyboard).toBe("open");

    act(() => {
      input.blur();
      window.dispatchEvent(new Event("focusout"));
    });
    expect(document.documentElement.dataset.wfKeyboard).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--keyboard-height")).toBe("0px");
  });

  it("ignores a viewport shrink with no field focused", () => {
    renderHook(() => useMobileKeyboard());

    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event("resize"));
    });

    expect(document.documentElement.dataset.wfKeyboard).toBeUndefined();
  });

  it("removes the mark on unmount", () => {
    const { unmount } = renderHook(() => useMobileKeyboard());
    act(() => {
      focusField();
      window.dispatchEvent(new Event("focusin"));
      viewport.height = 500;
      viewport.dispatchEvent(new Event("resize"));
    });
    unmount();
    expect(document.documentElement.dataset.wfKeyboard).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--keyboard-height")).toBe("");
  });
});
