import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The typed-text device copy loads on demand in the browser (`loadTypedTextScrub`). The jsdom setup
 * preloads it, so every other provider test writes the copy in the same render and could not see a
 * save that never happened once the module arrived later (found in the browser, 21 Oct 2026). Here
 * the modules are fresh, so the copy's code is not loaded when the first typed text is dispatched.
 */
describe("typed-text device copy, loaded on first use", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("writes the copy once its code has loaded, with the typed text replaced", async () => {
    const { WARD_FLOW_DEMO_STORAGE_KEY, WardFlowProvider, useWardFlow } =
      await import("@/components/ward-management/ward-flow-provider");
    const { TYPED_TEXT_NOT_KEPT } = await import("@/components/ward-management/ward-flow-typed-text-ledger");
    let current: ReturnType<typeof useWardFlow> | undefined;
    function Capture() {
      current = useWardFlow();
      return null;
    }
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    await waitFor(() => expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).not.toBeNull());
    const typed = "Synthetic typed blocker words 7kq";
    act(() => {
      current!.dispatch({
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: current!.now,
        movementId: current!.movements[0].id,
        blocker: typed,
      });
    });
    await waitFor(() =>
      expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toContain(TYPED_TEXT_NOT_KEPT),
    );
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).not.toContain(typed);
    expect(current!.savingOnDevice).toBe(true);
  });

  // SD-07 (audit, 5 Nov 2026): offline, the copy's code cannot load. Until the copy is written the
  // save marker must not say the stored save is the latest, and the earlier safe save stays as it was.
  it("marks the save as not the latest while the copy's code has not loaded, and keeps the earlier save", async () => {
    vi.doMock("@/components/ward-management/ward-flow-typed-text-scrub", () => new Promise(() => {}));
    try {
      const { WARD_FLOW_DEMO_STORAGE_KEY, WardFlowProvider, useWardFlow } =
        await import("@/components/ward-management/ward-flow-provider");
      let current: ReturnType<typeof useWardFlow> | undefined;
      function Capture() {
        current = useWardFlow();
        return null;
      }
      render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      await waitFor(() => expect(window.sessionStorage.getItem("ward-flow:demo-save-current")).toBe("1"));
      const earlier = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
      const typed = "Synthetic typed blocker words 8vz";
      act(() => {
        current!.dispatch({
          type: "RECORD_MOVEMENT_BLOCKER",
          role: "coordinator",
          now: current!.now,
          movementId: current!.movements[0].id,
          blocker: typed,
        });
      });
      expect(window.sessionStorage.getItem("ward-flow:demo-save-current")).toBeNull();
      expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBe(earlier);
      expect(earlier).not.toContain(typed);
    } finally {
      vi.doUnmock("@/components/ward-management/ward-flow-typed-text-scrub");
    }
  });
});
