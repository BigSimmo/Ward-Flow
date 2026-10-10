import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  useWardFlow,
  WARD_FLOW_DEMO_STORAGE_KEY,
} from "@/components/ward-management/ward-flow-provider";
import { migrateStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";

function Probe() {
  const { now, dispatch } = useWardFlow();
  return (
    <button onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 20 })}>
      Advance synthetic clock
    </button>
  );
}

describe("remediated demo storage compatibility", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 8, 10, 42));
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it("refuses pre-remediation v5 state instead of resuming unreviewed links and capacity", () => {
    const first = render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance synthetic clock" }));
    const old = JSON.parse(sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
    expect(old.state.clockOffsetMinutes).toBe(20);
    first.unmount();
    sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify({ ...old, version: 5 }));
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    const restored = JSON.parse(sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
    expect(restored.version).toBe(7);
    expect(restored.state.clockOffsetMinutes).toBe(0);
  });

  /** A save exactly as the last v6 build wrote it: today's save without planned admissions. */
  function v6SaveAfterAdvancing() {
    const first = render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance synthetic clock" }));
    const current = JSON.parse(sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
    first.unmount();
    const v6State = { ...current.state };
    delete v6State.plannedAdmissions;
    delete v6State.plannedAdmissionSequence;
    return { ...current, version: 6, state: v6State };
  }

  it("restores a v6 save with its data intact, adding an empty planned admissions list (Josh, 9 Oct 2026)", () => {
    const v6 = v6SaveAfterAdvancing();
    expect(v6.state.clockOffsetMinutes).toBe(20);
    expect("plannedAdmissions" in v6.state).toBe(false);
    sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify(v6));
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    const restored = JSON.parse(sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
    expect(restored.version).toBe(7);
    expect(restored.state.plannedAdmissions).toEqual([]);
    expect(restored.state.plannedAdmissionSequence).toBe(0);
    // Every v6 fact survives as saved, the advanced clock included.
    const kept = { ...restored.state };
    delete kept.plannedAdmissions;
    delete kept.plannedAdmissionSequence;
    expect(kept).toEqual(v6.state);
    expect(screen.queryByText(/could not be restored safely/)).toBeNull();
  });

  it("still refuses a v6 save that already carries v7 fields, and any other old version", () => {
    const v6 = v6SaveAfterAdvancing();
    sessionStorage.setItem(
      WARD_FLOW_DEMO_STORAGE_KEY,
      JSON.stringify({ ...v6, state: { ...v6.state, plannedAdmissions: [], plannedAdmissionSequence: 0 } }),
    );
    const second = render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(JSON.parse(sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!).state.clockOffsetMinutes).toBe(0);
    second.unmount();
    expect(migrateStoredWardFlowState(v6.state, 5)).toBeNull();
    expect(migrateStoredWardFlowState(v6.state, "6")).toBeNull();
    expect(migrateStoredWardFlowState(null, 6)).toBeNull();
    expect(migrateStoredWardFlowState(v6.state, 7)).toBe(v6.state);
  });
});
