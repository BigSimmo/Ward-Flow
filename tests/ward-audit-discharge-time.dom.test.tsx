import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
function Harness() {
  const { admissions, dispatch, patients } = useWardFlow();
  const a = admissions.find((a) => a.state === "occupied" && a.patientId)!;
  return (
    <>
      <output data-testid="target-umrn">{patients.find((p) => p.id === a.patientId)!.umrn}</output>
      <button
        onClick={() =>
          dispatch({
            type: "UPDATE_EXPECTED_DISCHARGE",
            role: "coordinator",
            now: 642,
            admissionId: a.id,
            expectedDischargeAt: 1440 + 840,
          })
        }
      >
        Set tomorrow
      </button>
      <DischargeBoard />
    </>
  );
}
it("populates the existing clock time when editing tomorrow's departure", () => {
  render(
    <WardFlowProvider initialNow={642}>
      <Harness />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Set tomorrow" }));
  fireEvent.click(screen.getByRole("button", { name: /Admission records/ }));
  const row = within(screen.getByRole("region", { name: "Discharge worklist" }))
    .getByText(screen.getByTestId("target-umrn").textContent!)
    .closest("tr")!;
  fireEvent.click(row);
  fireEvent.click(screen.getByTestId("ward-discharge-update-date-btn"));
  expect(screen.getByTestId("ward-discharge-new-time-input")).toHaveValue("14:00");
});
