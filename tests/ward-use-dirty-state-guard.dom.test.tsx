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

  it("removes a legacy stored draft without restoring typed text", () => {
    const onRestore = vi.fn();
    window.sessionStorage.setItem("wf-draft:test-form", "Draft note content");

    renderHook(() =>
      useDirtyStateGuard({
        key: "test-form",
        isDirty: false,
        onRestore,
      }),
    );

    expect(onRestore).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("wf-draft:test-form")).toBeNull();
  });

  it("never caches typed text and keeps the clearDraft API safe", () => {
    const { rerender, result } = renderHook(
      ({ isDirty, value }: { isDirty: boolean; value: string }) =>
        useDirtyStateGuard({
          key: "test-override",
          isDirty,
          value,
        }),
      { initialProps: { isDirty: true, value: "Clinical override justification" } },
    );

    expect(window.sessionStorage.getItem("wf-draft:test-override")).toBeNull();

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

    expect(window.sessionStorage.getItem("wf-draft:test-erase")).toBeNull();

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

    expect(callCount).toBe(0);

    // Rerender with new inline function reference
    rerender({ renderIndex: 2 });
    expect(callCount).toBe(0);
  });

  it("intercepts in-app link navigation when dirty and cancels when user dismisses confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { unmount } = renderHook(() =>
      useDirtyStateGuard({
        isDirty: true,
        confirmMessage: "Leave without saving?",
      }),
    );

    const link = document.createElement("a");
    link.href = "/mockups/ward-flow/movements";
    document.body.appendChild(link);

    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    link.dispatchEvent(clickEvent);

    expect(confirmSpy).toHaveBeenCalledWith("Leave without saving?");
    expect(clickEvent.defaultPrevented).toBe(true);

    link.remove();
    unmount();
  });

  it("allows in-app link navigation when dirty and user accepts confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const { unmount } = renderHook(() =>
      useDirtyStateGuard({
        isDirty: true,
      }),
    );

    const link = document.createElement("a");
    link.href = "/mockups/ward-flow/capacity";
    document.body.appendChild(link);

    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    link.dispatchEvent(clickEvent);

    expect(confirmSpy).toHaveBeenCalledWith("You have unsaved changes. Are you sure you want to leave?");
    expect(clickEvent.defaultPrevented).toBe(false);

    link.remove();
    unmount();
  });

  it("ignores modified clicks, target=_blank, and hash links", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { unmount } = renderHook(() =>
      useDirtyStateGuard({
        isDirty: true,
      }),
    );

    // 1. Modified click (metaKey)
    const navLink = document.createElement("a");
    navLink.href = "/mockups/ward-flow/settings";
    document.body.appendChild(navLink);

    const metaClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    navLink.dispatchEvent(metaClick);
    expect(confirmSpy).not.toHaveBeenCalled();

    // 2. target="_blank"
    const blankLink = document.createElement("a");
    blankLink.href = "/mockups/ward-flow/external";
    blankLink.target = "_blank";
    document.body.appendChild(blankLink);

    const blankClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    blankLink.dispatchEvent(blankClick);
    expect(confirmSpy).not.toHaveBeenCalled();

    // 3. Hash link
    const hashLink = document.createElement("a");
    hashLink.href = "#details";
    document.body.appendChild(hashLink);

    const hashClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    hashLink.dispatchEvent(hashClick);
    expect(confirmSpy).not.toHaveBeenCalled();

    navLink.remove();
    blankLink.remove();
    hashLink.remove();
    unmount();
  });

  it("supports passing a bare boolean isDirty to useDirtyStateGuard", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { rerender, unmount } = renderHook(({ isDirty }: { isDirty: boolean }) => useDirtyStateGuard(isDirty), {
      initialProps: { isDirty: false },
    });

    const link = document.createElement("a");
    link.href = "/mockups/ward-flow/board";
    document.body.appendChild(link);

    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    expect(confirmSpy).not.toHaveBeenCalled();

    rerender({ isDirty: true });

    const dirtyClick = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(dirtyClick);
    expect(confirmSpy).toHaveBeenCalled();
    expect(dirtyClick.defaultPrevented).toBe(true);

    link.remove();
    unmount();
  });
  it("composes navigation confirmation across mounted guards instead of letting one replace another", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const confirmNavigation = () =>
      (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean }).__wardFlowConfirmNavigation?.();

    const page = renderHook(() => useDirtyStateGuard({ isDirty: true, confirmMessage: "Page has unsaved text" }));
    // A clean guard mounted over the dirty page (the referral drawer) must not hide the page's warning.
    const drawer = renderHook(() => useDirtyStateGuard({ isDirty: false }));

    expect(confirmNavigation()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith("Page has unsaved text");

    // Closing the clean guard leaves the page's guard in place.
    drawer.unmount();
    expect(confirmNavigation()).toBe(false);

    page.unmount();
    expect(
      (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean }).__wardFlowConfirmNavigation,
    ).toBeUndefined();
  });

  it("intercepts popstate when dirty and restores history URL when user cancels confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const guardedHref = window.location.href;

    const { unmount } = renderHook(() =>
      useDirtyStateGuard({
        isDirty: true,
        confirmMessage: "Discard unsaved changes?",
      }),
    );

    const popEvent = new PopStateEvent("popstate", { state: { page: 1 } });
    const stopImmediateSpy = vi.spyOn(popEvent, "stopImmediatePropagation");
    window.dispatchEvent(popEvent);

    expect(confirmSpy).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(pushStateSpy).toHaveBeenCalledWith(window.history.state, "", guardedHref);
    expect(stopImmediateSpy).toHaveBeenCalled();

    unmount();
  });
});
