import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/WF-004",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import {
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Walk C item 3 (F-101 / K37, 13 Nov 2026): after "Record no transport needed" the patient page's
 * Transport row read "Not needed · Recorded on the movement" with no way back. Change sits beside the
 * badge, records that transport is needed (the same RECORD_TRANSPORT_NEED the ED row's Change sends)
 * and Log booking returns. The badge's words are unchanged. Synthetic records only.
 */

afterEach(cleanup);

const noop = () => {};
function contextFor(movement: Movement, overrides: Partial<PatientStatusContext> = {}): PatientStatusContext {
  return {
    movement,
    hasBedHold: true,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    onOpenPlacement: noop,
    onClearance: noop,
    onBookTransport: noop,
    onArrivalTime: noop,
    onRecordReturn: noop,
    onMarkAbsent: noop,
    onAbsenceStep: noop,
    onRecordCto: noop,
    onEndCto: noop,
    ...overrides,
  };
}

function notNeeded(): Movement {
  const base = seedWardFlowState().movements.find((movement) => movement.id === "WF-004")!;
  return { ...base, transport: undefined, transportNeed: { needed: false, at: NOW_ANCHOR } };
}

describe("the status card's Transport cell offers Change beside Not needed", () => {
  it("keeps the badge's words and adds a secondary Change that sends RECORD_TRANSPORT_NEED", () => {
    const onTransportNeeded = vi.fn();
    const status = buildPatientStatus("held", contextFor(notNeeded(), { onTransportNeeded }));
    const cell = status.cells.find((candidate) => candidate.key === "transport")!;
    expect(cell.value).toBe("Not needed");
    expect(cell.sub).toBe("Recorded on the movement");
    expect(cell.clear).toBe(true);
    expect(cell.action).toMatchObject({
      kind: "button",
      label: "Change",
      secondary: true,
      event: "RECORD_TRANSPORT_NEED",
    });
    if (cell.action?.kind === "button") cell.action.onClick({} as never);
    expect(onTransportNeeded).toHaveBeenCalledOnce();
  });

  it("follows the desk's role: left out for a desk that can never record it, greyed with the reason otherwise", () => {
    const movement = notNeeded();
    const never = buildPatientStatus("held", contextFor(movement, { onTransportNeeded: noop, roleLimit: () => null }));
    expect(never.cells.find((cell) => cell.key === "transport")!.action).toBeUndefined();
    const later = buildPatientStatus(
      "held",
      contextFor(movement, { onTransportNeeded: noop, roleLimit: () => "ED only" }),
    );
    expect(later.cells.find((cell) => cell.key === "transport")!.action).toEqual({
      kind: "unavailable",
      label: "Change",
      reason: "ED only",
    });
  });
});

function RecordNotNeeded() {
  const { dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "RECORD_TRANSPORT_NEED",
          role: "coordinator",
          now: NOW_ANCHOR,
          movementId: "WF-004",
          needed: false,
        })
      }
    >
      Record synthetic no transport needed
    </button>
  );
}

function NeedProbe() {
  const { movements } = useWardFlow();
  const need = movements.find((movement) => movement.id === "WF-004")?.transportNeed;
  return <output data-testid="need-probe">{need === undefined ? "not recorded" : String(need.needed)}</output>;
}

describe("Change on the patient page brings booking back", () => {
  it("records transport needed in one press, then Log booking shows again", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordNotNeeded />
        <NeedProbe />
        <PatientNowScreen movementId="WF-004" />
      </WardFlowProvider>,
    );
    act(() => fireEvent.click(screen.getByRole("button", { name: "Record synthetic no transport needed" })));
    const gate = () => screen.getByTestId("ward-patient-gate-transport");
    expect(gate()).toHaveTextContent("Not needed");
    expect(within(gate()).queryByRole("button", { name: /Log booking/u })).not.toBeInTheDocument();
    act(() => fireEvent.click(within(gate()).getByRole("button", { name: "Change no transport needed" })));
    expect(screen.getByTestId("need-probe")).toHaveTextContent("true");
    expect(gate()).not.toHaveTextContent("Not needed");
    expect(within(gate()).getByRole("button", { name: /Log booking/u })).toBeInTheDocument();
  });
});
