import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  useWardFlow,
  WARD_FLOW_DEMO_STORAGE_KEY,
} from "@/components/ward-management/ward-flow-provider";

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
});
