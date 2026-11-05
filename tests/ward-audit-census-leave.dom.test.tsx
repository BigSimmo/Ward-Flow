import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/search",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
const seed = seedWardFlowState();
const stay = seed.admissions.find(
  (a) =>
    a.state === "occupied" &&
    a.patientId &&
    a.awayAtEmergencyDepartmentSince === null &&
    !seed.leaveBeds.some((b) => b.admissionId === a.id) &&
    !seed.movements.some((m) => !m.closure && m.patientId === a.patientId),
)!;
function StartLeave() {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  return (
    <>
      <button
        onClick={() =>
          dispatch({
            type: "RECORD_LEAVE_BED",
            role: "ward",
            now: NOW_ANCHOR,
            unitId: stay.unitId,
            actingUnitId: stay.unitId,
            admissionId: stay.id,
            expectedReturn: NOW_ANCHOR + 180,
          })
        }
      >
        Start synthetic census leave
      </button>
      <output data-testid="leave-refusals">{rejections.length}</output>
    </>
  );
}
it("updates the mounted Patients row when the ward records leave", async () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StartLeave />
      <PatientSearchPage />
    </WardFlowProvider>,
  );
  const person = seed.patients.find((p) => p.id === stay.patientId)!;
  fireEvent.change(screen.getByLabelText("Find a person by name, UMRN or place"), { target: { value: person.umrn } });
  fireEvent.click(screen.getByRole("button", { name: "Start synthetic census leave" }));
  expect(screen.getByTestId("leave-refusals")).toHaveTextContent("0");
  const row = await screen.findByTestId(`ward-patient-search-row-adm:${stay.id}`);
  expect(row).toHaveTextContent("On leave");
  expect(row).toHaveTextContent("bed kept");
  expect(row).not.toHaveTextContent("Nothing open");
});
