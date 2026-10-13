import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardDemoNotSavedNote } from "@/components/ward-management/shell/ward-demo-saving";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";

/*
 * S-1 (audit 13 Oct 2026): typing free text stops the demonstration saving on this device (the
 * default-deny lock stays). The shell now says so with a quiet note instead of losing the day
 * silently on the next reload.
 */
describe("Not saved on this device note (S-1)", () => {
  let current: ReturnType<typeof useWardFlow> | undefined;
  function Capture() {
    current = useWardFlow();
    return null;
  }

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17, 10, 42, 0));
  });
  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("stays hidden while the day saves, and shows once typed text stops saving", () => {
    render(
      <WardFlowProvider>
        <Capture />
        <WardDemoNotSavedNote />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-demo-not-saved")).toBeNull();

    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
    });
    expect(screen.queryByTestId("ward-demo-not-saved")).toBeNull();

    act(() => {
      current!.dispatch({
        type: "ADD_PATIENT",
        role: "coordinator",
        now: current!.now,
        umrn: "UMRN-TEST-002",
        givenName: "Typed",
        familyName: "Synthetic",
        dateOfBirth: "1990-01-01",
      });
    });
    expect(screen.getByTestId("ward-demo-not-saved")).toHaveTextContent("Not saved on this device");
  });

  it("is never shown on a fixed-clock render, which never saves anyway", () => {
    render(
      <WardFlowProvider initialNow={0}>
        <WardDemoNotSavedNote />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-demo-not-saved")).toBeNull();
  });
});
