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
function openTomorrowDepartureEditor() {
  render(
    <WardFlowProvider initialNow={642}>
      <Harness />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Set tomorrow" }));
  // Discharges redesign (3 Nov 2026): Recorded (which replaced History) lists only departures, so
  // tomorrow's departure is opened from its bed release on Now, then its "Discharge record".
  const worklist = screen.getByRole("region", { name: "Discharge worklist" });
  for (const more of within(worklist).queryAllByRole("button", { name: /^Show \d+ more/ })) fireEvent.click(more);
  const row = within(worklist).getByText(screen.getByTestId("target-umrn").textContent!).closest("tr")!;
  fireEvent.click(within(row).getAllByRole("button")[0]!);
  fireEvent.click(screen.getByRole("button", { name: "Discharge record" }));
  // D-80 item 17: the coordinator gives its "on behalf of the ward" reason first.
  fireEvent.click(screen.getByRole("radio", { name: "The ward asked for help" }));
  fireEvent.click(screen.getByRole("button", { name: "Open record" }));
  fireEvent.click(screen.getByTestId("ward-discharge-update-date-btn"));
}

it("populates the existing clock time when editing tomorrow's departure", () => {
  openTomorrowDepartureEditor();
  expect(screen.getByTestId("ward-discharge-new-time-input")).toHaveValue("14:00");
});

it("refuses a bad time with words through the field, and keeps the form open (PR #1474 review)", () => {
  openTomorrowDepartureEditor();
  const input = screen.getByTestId("ward-discharge-new-time-input");
  fireEvent.change(input, { target: { value: "11:45pm" } });
  expect(input).toHaveValue("11:45pm");
  fireEvent.click(screen.getByTestId("ward-discharge-save-time-btn"));
  expect(screen.getByText("Type a 24-hour time, HH:MM")).toBeInTheDocument();
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByTestId("ward-discharge-new-time-input")).toBeInTheDocument();
  expect(screen.queryByText("Expected discharge updated.")).not.toBeInTheDocument();
});
