import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  WardAccessibility,
  useWardAccessibilityPreference,
} from "@/components/ward-management/shell/ward-accessibility";
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});
it("restores both preferences above route content and cleans up on leaving Ward", () => {
  localStorage.setItem("ward-flow-reduced-motion", "true");
  localStorage.setItem("ward-flow-high-contrast", "true");
  const view = render(<WardAccessibility />);
  expect(document.documentElement.hasAttribute("data-reduced-motion")).toBe(true);
  expect(document.documentElement.hasAttribute("data-high-contrast")).toBe(true);
  view.unmount();
  expect(document.documentElement.hasAttribute("data-reduced-motion")).toBe(false);
  expect(document.documentElement.hasAttribute("data-high-contrast")).toBe(false);
});
it("updates the shared layout immediately and persists the chosen preference", () => {
  render(<WardAccessibility />);
  const hook = renderHook(() => useWardAccessibilityPreference("reduced-motion"));
  act(() => hook.result.current[1](true));
  expect(document.documentElement.hasAttribute("data-reduced-motion")).toBe(true);
  expect(localStorage.getItem("ward-flow-reduced-motion")).toBe("true");
  act(() => hook.result.current[1](false));
  expect(document.documentElement.hasAttribute("data-reduced-motion")).toBe(false);
});
it("keeps toggles usable when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("disabled");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("disabled");
  });
  const hook = renderHook(() => useWardAccessibilityPreference("high-contrast"));
  act(() => hook.result.current[1](true));
  expect(hook.result.current[0]).toBe(true);
  act(() => hook.result.current[1](false));
  expect(hook.result.current[0]).toBe(false);
});
