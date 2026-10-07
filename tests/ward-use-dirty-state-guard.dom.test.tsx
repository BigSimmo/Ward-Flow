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

  it("upholds Decision D-18: never writes typed free-text to sessionStorage", () => {
    renderHook(() =>
      useDirtyStateGuard({
        key: "test-override",
        isDirty: true,
        value: "Clinical override justification containing psychiatric narrative",
      }),
    );

    // Free text must stay off the device per Decision D-18
    expect(window.sessionStorage.getItem("wf-draft:test-override")).toBeNull();
  });

  it("sanitizes legacy drafts by clearing key on mount and on clearDraft", () => {
    window.sessionStorage.setItem("wf-draft:legacy-form", "Stale draft from prior session");

    const { result } = renderHook(() =>
      useDirtyStateGuard({
        key: "legacy-form",
        isDirty: false,
      }),
    );

    // Mount sanitization: legacy key purged
    expect(window.sessionStorage.getItem("wf-draft:legacy-form")).toBeNull();

    // Explicit clearDraft helper works safely
    window.sessionStorage.setItem("wf-draft:legacy-form", "Another entry");
    act(() => {
      result.current.clearDraft();
    });
    expect(window.sessionStorage.getItem("wf-draft:legacy-form")).toBeNull();
  });

  it("removes beforeunload listener when unmounted or when isDirty becomes false", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { rerender, unmount } = renderHook(
      ({ isDirty }: { isDirty: boolean }) =>
        useDirtyStateGuard({
          key: "test-lifecycle",
          isDirty,
        }),
      { initialProps: { isDirty: true } },
    );

    rerender({ isDirty: false });
    expect(removeEventListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    unmount();
  });
});
