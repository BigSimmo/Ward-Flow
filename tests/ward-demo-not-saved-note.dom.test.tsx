import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardDemoNotSavedNote, WardDemoTypedTextNote } from "@/components/ward-management/shell/ward-demo-saving";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";

/*
 * S-1 (audit 13 Oct 2026): when the demonstration stops saving on this device, the shell says so with
 * a quiet note instead of losing the day silently on the next reload. Since 21 Oct 2026 typed text
 * stops the save only where its copy cannot be made safely (an unreadable event here); otherwise
 * a second note says typed text is not kept.
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

  // A9-07 (Josh, 13 Nov 2026): a typed date of birth no longer stops saving; an unreadable event does.
  it("stays hidden while the day saves, also after Add patient, and shows once saving stops", () => {
    render(
      <WardFlowProvider>
        <Capture />
        <WardDemoNotSavedNote />
        <WardDemoTypedTextNote />
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
    expect(screen.queryByTestId("ward-demo-not-saved")).toBeNull();

    act(() => {
      current!.dispatch({ type: "SYNTHETIC_UNCLASSIFIED_EVENT", role: "coordinator", now: current!.now } as never);
    });
    expect(screen.getByTestId("ward-demo-not-saved")).toHaveTextContent(
      "Demonstration state is not saved on this device",
    );
  });

  it("says typed text is not kept while the rest of the day still saves (Josh, 21 Oct 2026)", () => {
    render(
      <WardFlowProvider>
        <Capture />
        <WardDemoNotSavedNote />
        <WardDemoTypedTextNote />
      </WardFlowProvider>,
    );
    const movement = current!.movements.find((candidate) => !candidate.closure)!;
    act(() => {
      current!.dispatch({
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: current!.now,
        movementId: movement.id,
        blocker: "Synthetic typed blocker words",
      });
    });
    expect(screen.queryByTestId("ward-demo-not-saved")).toBeNull();
    expect(screen.getByTestId("ward-demo-typed-text-not-kept")).toHaveTextContent(
      "saved on this device, except typed text",
    );
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
