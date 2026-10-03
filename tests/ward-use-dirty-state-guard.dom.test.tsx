import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";

describe("useDirtyStateGuard", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches beforeunload listener when isDirty is true and prompts on unload", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { rerender, unmount } = renderHook(
      ({ isDirty }: { isDirty: boolean }) =>
        useDirtyStateGuard({
          isDirty,
          confirmMessage: "Unsaved text warning",
        }),
      { initialProps: { isDirty: false } },
    );

    expect(addEventListenerSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

    rerender({ isDirty: true });
    expect(addEventListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("caches draft in sessionStorage and restores it on mount", () => {
    const onRestore = vi.fn();
    window.sessionStorage.setItem("wf-draft:test-form", "Draft note content");

    renderHook(() =>
      useDirtyStateGuard({
        key: "test-form",
        isDirty: false,
        onRestore,
      }),
    );

    expect(onRestore).toHaveBeenCalledWith("Draft note content");
  });

  it("updates and clears draft in sessionStorage when dirtiness changes", () => {
    const { rerender, result } = renderHook(
      ({ isDirty, value }: { isDirty: boolean; value: string }) =>
        useDirtyStateGuard({
          key: "test-override",
          isDirty,
          value,
        }),
      { initialProps: { isDirty: true, value: "Clinical override justification" } },
    );

    expect(window.sessionStorage.getItem("wf-draft:test-override")).toBe("Clinical override justification");

    // Clear via clearDraft
    act(() => {
      result.current.clearDraft();
    });
    expect(window.sessionStorage.getItem("wf-draft:test-override")).toBeNull();

    // Rerender as clean
    rerender({ isDirty: false, value: "" });
    expect(window.sessionStorage.getItem("wf-draft:test-override")).toBeNull();
  });
});
