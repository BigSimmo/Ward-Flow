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
    // Ensure the restored draft is not immediately erased from sessionStorage by the mount commit
    expect(window.sessionStorage.getItem("wf-draft:test-form")).toBe("Draft note content");
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

  it("clears cached draft in sessionStorage when user erases text while remaining dirty", () => {
    const { rerender } = renderHook(
      ({ isDirty, value }: { isDirty: boolean; value: string }) =>
        useDirtyStateGuard({
          key: "test-erase",
          isDirty,
          value,
        }),
      { initialProps: { isDirty: true, value: "Preliminary clinical note" } },
    );

    expect(window.sessionStorage.getItem("wf-draft:test-erase")).toBe("Preliminary clinical note");

    // User deletes all content from the input
    rerender({ isDirty: true, value: "" });
    expect(window.sessionStorage.getItem("wf-draft:test-erase")).toBeNull();
  });

  it("handles QuotaExceededError and disabled storage gracefully without throwing", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    expect(() => {
      renderHook(() =>
        useDirtyStateGuard({
          key: "quota-test",
          isDirty: true,
          value: "Large clinical payload",
        }),
      );
    }).not.toThrow();

    setItemSpy.mockRestore();
  });

  it("does not re-trigger onRestore when an inline callback identity changes on re-render", () => {
    window.sessionStorage.setItem("wf-draft:test-identity", "Cached content");
    let callCount = 0;

    const { rerender } = renderHook(
      // `renderIndex` only exists to force a rerender with a new inline `onRestore`.
      () =>
        useDirtyStateGuard({
          key: "test-identity",
          isDirty: false,
          onRestore: () => {
            callCount++;
          },
        }),
      { initialProps: { renderIndex: 1 } },
    );

    expect(callCount).toBe(1);

    // Rerender with new inline function reference
    rerender({ renderIndex: 2 });
    expect(callCount).toBe(1);
  });
});
