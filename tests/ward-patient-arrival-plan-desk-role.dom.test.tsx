// R-STRUCT-4 (Josh, 14 Nov 2026; Together-X1b-6), synthetic seed only. The signed rules let the ED
// and the accepting ward save the arrival plan (SET_ARRIVAL_DETAILS). The patient page sent it as the
// coordinator, which the shared server refuses for those desks; it now goes as the desk's own role.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const PATH = "/ward-flow/people/WF-004";
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => PATH,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function ArrivalPlanProbe() {
  const { movements } = useWardFlow();
  const details = movements.find((movement) => movement.id === "WF-004")?.arrivalDetails;
  return <output data-testid="arrival-plan-by">{details ? (details.updatedBy ?? details.recordedBy) : "none"}</output>;
}

afterEach(() => {
  cleanup();
  setDeskRole("coordinator");
});

describe("the patient page saves the arrival plan as the desk's own role", () => {
  it("records the ED desk's arrival plan as the ED clinician", async () => {
    act(() => setDeskRole("ed", PATH));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-004" />
        <ArrivalPlanProbe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-patient-transport-row"));
    fireEvent.click(screen.getByText("Arrival plan & transport documents"));
    fireEvent.click(screen.getByTestId("ward-patient-update-arrival-btn"));
    const dialog = await screen.findByRole("dialog", { name: "Update arrival time & transport" });
    fireEvent.change(within(dialog).getByLabelText("How they are travelling"), { target: { value: "ambulance" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^\+1h/u }));
    fireEvent.click(within(dialog).getByTestId("save-arrival-plan-button"));
    expect(screen.getByTestId("arrival-plan-by")).toHaveTextContent("ed");
  });
});
