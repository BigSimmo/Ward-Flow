import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  useDirtyStateGuard,
  WARD_HISTORY_TRAVERSAL_CANCELLED,
} from "@/components/ward-management/use-dirty-state-guard";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import {
  discardReferralDraft,
  forgetReferrerContact,
  readKeptReferralDraft,
} from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/waiting",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

/** The shell retains its drawer until the history close reaches its bubble listener. */
function HistoryClosingReferral() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);
  return open ? (
    <WardReferralDrawer
      onClose={() =>
        window.dispatchEvent(
          new PopStateEvent("popstate", {
            state: { __NA: true, __wfHistoryIndex: window.history.state.__wfHistoryIndex - 1 },
          }),
        )
      }
    />
  ) : null;
}

function openTypedReferral() {
  window.history.replaceState({ __NA: true, wardDrawer: "referral" }, "", "/ward-flow/waiting");
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HistoryClosingReferral />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Referral" }));
  const openingReason = (screen.getByLabelText(/Reason for referral/) as HTMLTextAreaElement).value;
  fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Synthetic referral draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
  return openingReason;
}

/** Observe the capture guard, then stop jsdom from scheduling unrelated document/hash navigation. */
function dispatchGuardedLink(link: HTMLAnchorElement, event: MouseEvent): boolean {
  let preventedByGuard: boolean | undefined;
  link.addEventListener(
    "click",
    (click) => {
      preventedByGuard = click.defaultPrevented;
      click.preventDefault();
    },
    { once: true },
  );
  link.dispatchEvent(event);
  return preventedByGuard ?? event.defaultPrevented;
}

describe("useDirtyStateGuard", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    discardReferralDraft();
    forgetReferrerContact();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    discardReferralDraft();
    forgetReferrerContact();
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

  it("P158: skips only the browser unload prompt while unloadSafe says the work survives a reload", () => {
    let safe = true;
    const { rerender } = renderHook(
      ({ unloadSafe }: { unloadSafe?: () => boolean }) => useDirtyStateGuard({ isDirty: true, unloadSafe }),
      { initialProps: { unloadSafe: () => safe } as { unloadSafe?: () => boolean } },
    );
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    // Asked at unload time, so a later change (an edit not yet kept) prompts again without a re-render.
    safe = false;
    expect(unload()).toBe(true);
    // Other guard users pass no option: unchanged, always prompt while dirty.
    rerender({ unloadSafe: undefined });
    expect(unload()).toBe(true);
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
    link.href = "/ward-flow/movements";
    document.body.appendChild(link);

    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    const preventedByGuard = dispatchGuardedLink(link, clickEvent);

    expect(confirmSpy).toHaveBeenCalledWith("Leave without saving?");
    expect(preventedByGuard).toBe(true);

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
    link.href = "/ward-flow/capacity";
    document.body.appendChild(link);

    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    const preventedByGuard = dispatchGuardedLink(link, clickEvent);

    expect(confirmSpy).toHaveBeenCalledWith("You have unsaved changes. Are you sure you want to leave?");
    expect(preventedByGuard).toBe(false);

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
    navLink.href = "/ward-flow/settings";
    document.body.appendChild(navLink);

    const metaClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    dispatchGuardedLink(navLink, metaClick);
    expect(confirmSpy).not.toHaveBeenCalled();

    // 2. target="_blank"
    const blankLink = document.createElement("a");
    blankLink.href = "/ward-flow/external";
    blankLink.target = "_blank";
    document.body.appendChild(blankLink);

    const blankClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    dispatchGuardedLink(blankLink, blankClick);
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
    dispatchGuardedLink(hashLink, hashClick);
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
    link.href = "/ward-flow/board";
    document.body.appendChild(link);

    dispatchGuardedLink(link, new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    expect(confirmSpy).not.toHaveBeenCalled();

    rerender({ isDirty: true });

    const dirtyClick = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    const preventedByGuard = dispatchGuardedLink(link, dirtyClick);
    expect(confirmSpy).toHaveBeenCalled();
    expect(preventedByGuard).toBe(true);

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

  it("cancels native traversal before an earlier router listener can hide the dirty form", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    let unmount = () => {};
    const router = vi.fn(() => unmount());
    window.addEventListener("popstate", router);
    const hook = renderHook(() => useDirtyStateGuard({ isDirty: true }));
    unmount = hook.unmount;
    window.dispatchEvent(
      new PopStateEvent("popstate", {
        state: { __NA: true, __wfHistoryIndex: window.history.state.__wfHistoryIndex - 1 },
      }),
    );
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(router).not.toHaveBeenCalled();
    hook.unmount();
    window.removeEventListener("popstate", router);
  });

  it("intercepts popstate when dirty, undoes back/forward traversal, and suppresses the compensating popstate", () => {
    window.history.replaceState({ __NA: true }, "", "/ward-flow/board");
    const index = window.history.state.__wfHistoryIndex as number;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const goSpy = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const cancelled = vi.fn();
    window.addEventListener(WARD_HISTORY_TRAVERSAL_CANCELLED, cancelled);

    const { unmount } = renderHook(() =>
      useDirtyStateGuard({
        isDirty: true,
        confirmMessage: "Discard unsaved changes?",
      }),
    );

    // 1. Back traversal (page 2 -> page 1) cancelled: undoes with history.go(1)
    const backPopEvent = new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: index - 1 } });
    const stopImmediateSpy = vi.spyOn(backPopEvent, "stopImmediatePropagation");
    window.dispatchEvent(backPopEvent);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(goSpy).toHaveBeenLastCalledWith(1);
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(stopImmediateSpy).toHaveBeenCalled();
    expect(cancelled).not.toHaveBeenCalled();

    // 2. Compensating popstate fired by history.go(1) is ignored without re-prompting
    const compensatingBackEvent = new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: index } });
    window.dispatchEvent(compensatingBackEvent);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(goSpy).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledOnce();

    // 3. Forward traversal (page 2 -> page 3) cancelled: undoes with history.go(-1)
    const forwardPopEvent = new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: index + 1 } });
    window.dispatchEvent(forwardPopEvent);
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(goSpy).toHaveBeenLastCalledWith(-1);

    // 4. Compensating popstate fired by history.go(-1) is ignored
    const compensatingForwardEvent = new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: index } });
    window.dispatchEvent(compensatingForwardEvent);
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(cancelled).toHaveBeenCalledTimes(2);

    unmount();
    window.removeEventListener(WARD_HISTORY_TRAVERSAL_CANCELLED, cancelled);
  });
  it.each(["Discard", "Keep draft"])(
    "honours the referral's explicit %s before a synchronous history close",
    (choice) => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      vi.spyOn(window.history, "go").mockImplementation(() => undefined);
      openTypedReferral();
      fireEvent.click(screen.getByRole("button", { name: choice }));
      expect(screen.queryByRole("button", { name: "Close referral side drawer" })).toBeNull();
      expect(confirmSpy).not.toHaveBeenCalled();
    },
  );

  it("does not prompt again if the sole dirty draft changes before a compensating traversal", () => {
    window.history.replaceState({ __NA: true }, "", "/ward-flow/board");
    const index = window.history.state.__wfHistoryIndex as number;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const cancelled = vi.fn();
    window.addEventListener(WARD_HISTORY_TRAVERSAL_CANCELLED, cancelled);
    const hook = renderHook(({ value }) => useDirtyStateGuard({ isDirty: true, value }), {
      initialProps: { value: "Synthetic draft A" },
    });
    window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: index - 1 } }));
    expect(confirmSpy).toHaveBeenCalledOnce();
    hook.rerender({ value: "Synthetic draft B" });
    window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: index } }));
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(cancelled).toHaveBeenCalledOnce();
    hook.unmount();
    window.removeEventListener(WARD_HISTORY_TRAVERSAL_CANCELLED, cancelled);
  });

  it("preserves another dirty guard and rearms a retained referral when its text changes", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const other = renderHook(() => useDirtyStateGuard({ isDirty: true, confirmMessage: "Other form is dirty" }));
    openTypedReferral();
    const sourceIndex = window.history.state.__wfHistoryIndex as number;
    fireEvent.click(screen.getByRole("button", { name: "Keep draft" }));
    expect(confirmSpy).toHaveBeenCalledWith("Other form is dirty");
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("Synthetic referral draft");
    // Settle the mocked reverse traversal before interacting with the retained drawer again.
    window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true, __wfHistoryIndex: sourceIndex } }));
    other.unmount();
    const confirmNavigation = () =>
      (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean }).__wardFlowConfirmNavigation?.();
    confirmSpy.mockClear();
    // The approval was consumed by the cancelled traversal; it cannot permit a later page Back.
    expect(confirmNavigation()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText(/Reason for referral/), {
      target: { value: "Synthetic referral draft edited again" },
    });
    expect(confirmNavigation()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledTimes(2);
  });

  it("closes a clean referral while its earlier autosave is still being cleared", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const openingReason = openTypedReferral();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(readKeptReferralDraft()).not.toBeNull());
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: openingReason } });
    // The selected section is part of the kept draft too; restore the complete opening baseline.
    fireEvent.click(screen.getByRole("button", { name: "Patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    expect(screen.queryByRole("button", { name: "Close referral side drawer" })).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
