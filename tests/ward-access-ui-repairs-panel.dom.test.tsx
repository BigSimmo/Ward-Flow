import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const view = vi.hoisted(() => ({ readOnly: false }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/synthetic",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/shell/ward-access", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access")>()),
  useIsBreakGlassRecord: () => () => view.readOnly,
}));
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import {
  SharedSessionContext,
  type SharedSession,
} from "@/components/ward-management/shell/ward-shared-session-context";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
const seed = seedWardFlowState();
const occupied = seed.admissions.find(
  (a) =>
    a.state === "occupied" &&
    a.patientId &&
    a.awayAtEmergencyDepartmentSince === null &&
    !seed.leaveBeds.some((b) => b.admissionId === a.id),
)!;
const movement = seed.movements.find((m) => m.stage === "pulled" && m.patientId)!;
afterEach(() => {
  cleanup();
  view.readOnly = false;
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});
function desk() {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [occupied.unitId] } });
  });
}
function show(session: SharedSession, patientId?: string, movementId?: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SharedSessionContext.Provider value={session}>
        <PatientNowScreen patientId={patientId} movementId={movementId} />
      </SharedSessionContext.Provider>
    </WardFlowProvider>,
  );
}
it("passes the record-specific read-only limit to otherwise permitted ward controls", async () => {
  desk();
  view.readOnly = true;
  show({ signOut: vi.fn(), logRecordView: vi.fn() }, occupied.patientId!);
  const card = await screen.findByTestId("ward-patient-change-card");
  for (const label of ["Start leave", "Gone to ED", "Discharge date"]) {
    const button = within(card).getByRole("button", { name: label });
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
  }
  expect(within(card).queryByRole("form")).toBeNull();
});
it.each([true, false])(
  "uses an authenticated membership choice or owning-desk instruction, picker=%s",
  async (picker) => {
    desk();
    const switchRole = vi.fn();
    show({ signOut: vi.fn(), logRecordView: vi.fn(), ...(picker ? { switchRole } : {}) }, undefined, movement.id);
    await waitFor(() => expect(screen.getByTestId("ward-patient-role-lockline")).toBeInTheDocument());
    const lockline = screen.getByTestId("ward-patient-role-lockline");
    if (picker) {
      fireEvent.click(within(lockline).getByRole("button", { name: "Choose an authorised desk →" }));
      expect(switchRole).toHaveBeenCalledOnce();
    } else {
      expect(within(lockline).queryByRole("button")).toBeNull();
      expect(lockline).toHaveTextContent(/Ask the .+ desk to record this change/);
    }
  },
);
