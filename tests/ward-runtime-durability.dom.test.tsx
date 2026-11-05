import { useEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
let current: ReturnType<typeof useWardFlow>;
function Capture() {
  const value = useWardFlow();
  useEffect(() => {
    current = value;
  }, [value]);
  return null;
}
function unloadPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});
describe("local device durability", () => {
  it("protects an accepted command before its device-write effect completes", async () => {
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    await waitFor(() => expect(current.sessionAdopted).toBe(true));
    expect(unloadPrevented()).toBe(false);
    act(() => {
      current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 5 });
      expect(unloadPrevented()).toBe(true);
    });
    expect(unloadPrevented()).toBe(false);
  });
  it("protects non-text changes when the device write fails", async () => {
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    await waitFor(() => expect(current.sessionAdopted).toBe(true));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 5 }));
    expect(current.savingOnDevice).toBe(false);
    expect(unloadPrevented()).toBe(true);
  });
  it("protects an imported day before its device-write effect completes", async () => {
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    await waitFor(() => expect(current.sessionAdopted).toBe(true));
    const file = await current.saveScenarioFile!();
    if (!file.ok) throw new Error(file.reason);
    expect(unloadPrevented()).toBe(false);
    await act(async () => {
      expect((await current.loadScenarioFile!(file.json)).ok).toBe(true);
      expect(unloadPrevented()).toBe(true);
    });
    await waitFor(() => expect(unloadPrevented()).toBe(false));
  });
});
