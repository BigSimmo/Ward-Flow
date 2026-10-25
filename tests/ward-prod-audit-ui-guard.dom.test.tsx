import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/waiting",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";

/**
 * Production audit CD-05: two dirty forms (a page form and a drawer over it) ask "unsaved
 * changes?" once for one link tap, as the shell's buttons already do.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CD-05: one prompt for one link tap", () => {
  it("asks once when two guards are dirty and the person confirms", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHook(() => useDirtyStateGuard({ isDirty: true, confirmMessage: "Leave the page form?" }));
    renderHook(() => useDirtyStateGuard({ isDirty: true, confirmMessage: "Leave the drawer form?" }));

    const link = document.createElement("a");
    link.href = "/ward-flow/movements";
    document.body.appendChild(link);
    // Stop jsdom navigating; the guards run in the capture phase before this.
    link.addEventListener("click", (event) => event.preventDefault());
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    link.remove();
  });

  it("still stops the tap when the person cancels", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHook(() => useDirtyStateGuard({ isDirty: true }));
    renderHook(() => useDirtyStateGuard({ isDirty: true }));

    const link = document.createElement("a");
    link.href = "/ward-flow/movements";
    document.body.appendChild(link);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    link.remove();
  });
});
