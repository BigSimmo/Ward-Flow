import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PATHNAME = "/ward-flow/people/synthetic-return";
vi.mock("next/navigation", () => ({
  usePathname: () => PATHNAME,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf/toast-provider";

/*
 * F-101 / K37 (13 Nov 2026), helper JA: a ward desk's Change beside "Not needed" on the patient page
 * records transport needed as the sending ward, so the toast's Undo must name that ward too. Before
 * the fix it sent no ward and the engine refused it ("Only the ward that made this decision ...").
 * The journey is a synthetic agreed return from a seeded ward stay. Synthetic records only.
 */

afterEach(() => {
  cleanup();
  setDeskRole("coordinator", "");
});

function ReturnJourney() {
  const { dispatch, admissions, movements, rejections } = useWardFlow();
  const [movementId, setMovementId] = useState<string>();
  const need = movements.find((movement) => movement.id === movementId)?.transportNeed;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const stay = admissions.find(
            (admission) =>
              admission.state === "occupied" && admission.patientId && !admission.unitId.startsWith("rph-"),
          )!;
          dispatch({
            type: "RECORD_REPATRIATION",
            role: "coordinator",
            now: NOW_ANCHOR,
            admissionId: stay.id,
            homeHospital: "RPH",
            receivingWardAgreed: true,
            mode: "road",
            provider: "Ambulance service",
            cadNumber: "",
            transportLegalStatus: "involuntary",
          } as never);
        }}
      >
        Agree synthetic return
      </button>
      <button
        type="button"
        onClick={() => {
          const returning = movements.at(-1)!;
          setMovementId(returning.id);
          dispatch({
            type: "RECORD_TRANSPORT_NEED",
            role: "coordinator",
            now: NOW_ANCHOR,
            movementId: returning.id,
            needed: false,
          });
        }}
      >
        Record synthetic no transport needed
      </button>
      <output data-testid="need-probe">{need === undefined ? "not recorded" : String(need.needed)}</output>
      <output data-testid="rejection-probe">{rejections.at(-1)?.reason ?? ""}</output>
      {movementId ? <PatientNowScreen movementId={movementId} /> : null}
    </>
  );
}

describe("a ward desk's Undo of the patient page's transport-need Change", () => {
  it("takes the Change back instead of being refused", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <ReturnJourney />
        </WardFlowProvider>
      </ToastProvider>,
    );
    act(() => fireEvent.click(screen.getByRole("button", { name: "Agree synthetic return" })));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Record synthetic no transport needed" })));
    expect(screen.getByTestId("need-probe")).toHaveTextContent("false");
    act(() => setDeskRole("ward", PATHNAME));
    const gate = () => screen.getByTestId("ward-patient-gate-transport");
    act(() => fireEvent.click(within(gate()).getByRole("button", { name: "Change no transport needed" })));
    expect(screen.getByTestId("need-probe")).toHaveTextContent("true");
    act(() => fireEvent.click(screen.getByRole("button", { name: "Undo" })));
    expect(screen.getByTestId("rejection-probe")).not.toHaveTextContent(/Only the ward that made this decision/u);
    expect(screen.getByTestId("need-probe")).toHaveTextContent("false");
  });
});
