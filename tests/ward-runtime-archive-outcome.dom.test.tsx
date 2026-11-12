import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatientArchivePanel } from "@/components/ward-management/patients/patient-archive-panel";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
const mocks = vi.hoisted(() => ({ raise: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/ward-management/ward-flow-raise", () => ({ useWardRaise: () => mocks.raise }));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowSelect: () => ({}),
  useWardFlowClock: () => 0,
}));
vi.mock("@/components/ward-management/ward-role-gate", () => ({
  useRoleGate: () => () => ({ allowed: true }),
  useRouteRole: () => "coordinator",
}));
vi.mock("@/components/ward-management/ward-patient-archive", async (original) => ({
  ...(await original<object>()),
  patientArchiveProblem: () => undefined,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function begin() {
  render(<PatientArchivePanel patientId="PT-SYNTHETIC" displayName="Synthetic record" />);
  fireEvent.click(screen.getAllByRole("radio")[0]);
  fireEvent.click(screen.getByTestId("ward-patient-archive-start"));
  fireEvent.click(screen.getByTestId("ward-patient-archive-confirm"));
}
describe("archive completion feedback", () => {
  it("says uncertain then follows the same command's eventual accepted receipt", async () => {
    let confirm!: (outcome: WardCommandOutcome) => void;
    mocks.raise.mockReturnValue({
      commandId: "archive-one",
      status: "failed",
      confirmation: new Promise<WardCommandOutcome>((resolve) => {
        confirm = resolve;
      }),
    });
    begin();
    expect(screen.getByRole("alert")).toHaveTextContent("Archive is not confirmed");
    expect(screen.getByRole("alert")).not.toHaveTextContent("not archived");
    fireEvent.click(screen.getByTestId("ward-patient-archive-confirm"));
    expect(mocks.raise).toHaveBeenCalledTimes(1);
    await act(async () => confirm({ commandId: "archive-one", status: "accepted" }));
    expect(mocks.replace).toHaveBeenCalledWith("/ward-flow/search");
  });
  it("reports a definitive refusal without claiming success", () => {
    mocks.raise.mockReturnValue({ commandId: "archive-two", status: "refused", message: "Care was recorded." });
    begin();
    expect(screen.getByRole("alert")).toHaveTextContent("The record was not archived. Care was recorded.");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
