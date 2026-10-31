import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { sheetSignOff } from "@/components/ward-management/handover/handover-sign-off-checks";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/handover",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
});

let flow: ReturnType<typeof useWardFlow>;
function Probe() {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  }, [value]);
  return null;
}

function renderAtDesk(access: WardAccess) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
  render(
    <WardFlowProvider initialNow={600}>
      <WardAccessScope>
        <HandoverPage />
        <Probe />
      </WardAccessScope>
    </WardFlowProvider>,
  );
  // 10:00, so the 15:00 handover is the one open for sign-off.
  fireEvent.click(screen.getByRole("radio", { name: /15:00/ }));
}

// Decision 41 (Josh, 31 Oct 2026): the Handover page names the ward whose sheet it signs off.
describe("Handover sign-off names its ward", () => {
  it("a one-ward desk's sign-off names that ward", () => {
    renderAtDesk({ role: "ward", scope: { kind: "ward", unitIds: ["brm-adult-secure"] } });
    fireEvent.click(screen.getByTestId("ward-handover-sign-off-button"));
    expect(flow.handoverSignOffs).toEqual([expect.objectContaining({ at: 600, unitId: "brm-adult-secure" })]);
  });

  it("a ward desk holding two wards chooses one before signing off", () => {
    renderAtDesk({ role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure", "fsh-older-adult"] } });
    const button = screen.queryByTestId("ward-handover-sign-off-button");
    if (button) fireEvent.click(button);
    expect(flow.handoverSignOffs).toHaveLength(0);
  });

  it("one ward's sign-off never marks another ward's sheet, or a wider sheet, signed", () => {
    const signOffs = [{ at: 600, by: "ward" as const, unitId: "fsh-adult-secure" }];
    expect(sheetSignOff(signOffs, 900, "fsh-adult-secure")).toEqual({ signedAt: 600, signedBy: "ward" });
    expect(sheetSignOff(signOffs, 900, "fsh-older-adult")).toEqual({ signedAt: null, signedBy: null });
    expect(sheetSignOff(signOffs, 900, undefined)).toEqual({ signedAt: null, signedBy: null });
    const wider = [{ at: 610, by: "coordinator" as const }];
    expect(sheetSignOff(wider, 900, undefined)).toEqual({ signedAt: 610, signedBy: "coordinator" });
  });
});
