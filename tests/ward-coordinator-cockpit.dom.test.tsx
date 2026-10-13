import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CoordinatorCockpit } from "@/components/ward-management/coordinator/coordinator-cockpit";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

function TestActionTrigger() {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-dispatch-btn"
      onClick={() => {
        dispatch({
          type: "SET_CONFIGURATION",
          role: "ward" as never,
          now: NOW_ANCHOR,
          payload: { pullHoldMinutes: 45 } as never,
        });
      }}
    >
      Dispatch Action
    </button>
  );
}

describe("CoordinatorCockpit (WF-A1-15)", () => {
  it("renders the coordinator cockpit container wrapping the coordinator screen", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorCockpit />
      </WardFlowProvider>,
    );

    const cockpit = screen.getByTestId("ward-coordinator-cockpit");
    expect(cockpit).toBeInTheDocument();

    const footer = screen.getByTestId("ward-coordinator-governance");
    expect(footer).toBeInTheDocument();
  });

  it("dispatches actions with role: 'coordinator' overriding any child role", () => {
    const onDispatch = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorCockpit onDispatchAction={onDispatch}>
          <TestActionTrigger />
        </CoordinatorCockpit>
      </WardFlowProvider>,
    );

    const btn = screen.getByTestId("test-dispatch-btn");
    fireEvent.click(btn);

    expect(onDispatch).toHaveBeenCalledTimes(1);
    const event = onDispatch.mock.calls[0][0] as WardFlowEvent;
    expect(event.role).toBe("coordinator");
    expect(event.type).toBe("SET_CONFIGURATION");
  });
});
