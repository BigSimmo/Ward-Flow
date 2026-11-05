import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/synthetic",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import {
  setWardAccess,
  breakGlass,
  resetWardAccessStoreForTests,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
afterEach(() => {
  resetWardAccessStoreForTests();
  window.localStorage.clear();
});
describe("exceptional record UI", () => {
  it("reads the opened ward stay without offering its change form or archive editor", async () => {
    const seed = seedWardFlowState();
    const stay = seed.admissions.find(
      (entry) =>
        entry.unitId !== "rph-adult-secure" && entry.patientId && entry.leftAt == null && entry.state === "occupied",
    )!;
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
      breakGlass({
        patientId: stay.patientId!,
        now: NOW_ANCHOR,
        windowMinutes: 60,
        reason: "handover",
        placeLabel: "Synthetic ward",
      });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAccessScope>
          <PatientNowScreen patientId={stay.patientId!} />
        </WardAccessScope>
      </WardFlowProvider>,
    );
    expect(
      await screen.findByText("Exceptional access is read only. Clinical and record changes are unavailable."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-change-card")).toBeNull();
    expect(screen.queryByTestId("ward-patient-archive")).toBeNull();
  });
});
