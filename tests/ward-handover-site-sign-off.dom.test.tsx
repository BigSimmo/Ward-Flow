import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { namesInProse } from "@/components/ward-management/handover/handover-site-sign-off";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/handover",
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
});

// Synthetic seed wards only: Royal Perth (RPH) has two wards.
const rph = seedWardFlowState().units.filter((unit) => unit.siteCode === "RPH");
const rphManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } };

let flow: ReturnType<typeof useWardFlow>;
function Probe() {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  }, [value]);
  return null;
}

function renderAtDesk(access: WardAccess) {
  window.history.replaceState(null, "", "/ward-flow/handover");
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
  // 10:00, so the 15:00 handover is the next one.
  render(
    <WardFlowProvider initialNow={600}>
      <WardAccessScope>
        <HandoverPage />
        <Probe />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

// Josh, 31 Oct 2026 (questions 40 and 61 to 63): the site bed manager signs off its own site only.
describe("Site bed manager's site sign-off on Handover", () => {
  it("lists each site ward read only and the four checks in order, with no ward Sign off", async () => {
    renderAtDesk(rphManager);
    const panel = await screen.findByTestId("ward-handover-site-sign-off");
    const wards = within(within(panel).getByTestId("ward-handover-site-wards")).getAllByRole("listitem");
    expect(wards).toHaveLength(rph.length);
    rph.forEach((unit, index) => {
      expect(wards[index]).toHaveTextContent(unit.name);
      expect(wards[index]).toHaveTextContent("Not signed yet");
      expect(within(wards[index]!).queryByRole("button", { name: /sign off/i })).toBeNull();
    });
    const checks = within(within(panel).getByTestId("ward-handover-site-checks")).getAllByRole("listitem");
    expect(checks.map((row) => row.querySelector("b")?.textContent?.trim())).toEqual([
      "Bed numbers confirmed",
      "Discharge blockers reviewed",
      "Bed meeting actions due today",
      "Bed calls answered",
    ]);
  });

  it("signs off the site with wards unsigned, names them, and Undo takes it back", async () => {
    renderAtDesk(rphManager);
    const button = await screen.findByTestId("ward-handover-site-sign-off-button");
    // Q62 and Q63: never disabled by an open check or an unsigned ward.
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(flow.siteHandoverSignOffs).toEqual([
      expect.objectContaining({
        siteCode: "RPH",
        shiftAt: 900,
        by: "bed_manager",
        unsignedUnitIds: rph.map((u) => u.id),
      }),
    ]);
    expect(flow.handoverSignOffs).toHaveLength(0);
    const status = screen.getByTestId("ward-handover-site-signed");
    expect(status).toHaveTextContent(
      `as site bed manager. ${namesInProse(rph.map((u) => u.name))} were not signed yet.`,
    );
    expect(status).toHaveTextContent("Recorded in History.");
    const wards = within(screen.getByTestId("ward-handover-site-wards")).getAllByRole("listitem");
    for (const row of wards) expect(row).toHaveTextContent("Not signed yet · outstanding");

    fireEvent.click(screen.getByTestId("ward-handover-site-undo"));
    expect(flow.siteHandoverSignOffs ?? []).toHaveLength(0);
    expect(screen.getByTestId("ward-handover-site-sign-off-button")).toBeInTheDocument();
  });

  it("shows a ward's own sign-off, and Open handover opens that ward's sheet", async () => {
    renderAtDesk(rphManager);
    await screen.findByTestId("ward-handover-site-sign-off");
    act(() => {
      flow.dispatch({ type: "RECORD_HANDOVER_SIGN_OFF", role: "ward", now: 600, unitId: rph[0]!.id });
    });
    const wards = within(screen.getByTestId("ward-handover-site-wards")).getAllByRole("listitem");
    expect(wards[0]).toHaveTextContent(/Signed .* by Nurse in charge/);
    fireEvent.click(within(wards[1]!).getByRole("button", { name: `Open ${rph[1]!.name} handover` }));
    expect(screen.getByTestId("ward-handover-hero")).toHaveTextContent(rph[1]!.name);
  });

  it("shows only beside the handover sheet, so opening a ward always lands on its sheet", async () => {
    renderAtDesk(rphManager);
    await screen.findByTestId("ward-handover-site-sign-off");
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.queryByTestId("ward-handover-site-sign-off")).toBeNull();
  });

  it("is not shown to any other desk", async () => {
    renderAtDesk({ role: "coordinator", scope: { kind: "statewide" } });
    await screen.findByTestId("ward-handover-hero");
    expect(screen.queryByTestId("ward-handover-site-sign-off")).toBeNull();
    cleanup();
    renderAtDesk({ role: "ward", scope: { kind: "ward", unitIds: [rph[0]!.id] } });
    await screen.findByTestId("ward-handover-hero");
    expect(screen.queryByTestId("ward-handover-site-sign-off")).toBeNull();
  });

  it("names wards in plain prose", () => {
    expect(namesInProse(["Ward 4B"])).toBe("Ward 4B");
    expect(namesInProse(["Ward 4B", "Ward 5C"])).toBe("Ward 4B and Ward 5C");
    expect(namesInProse(["Ward 3A", "Ward 4B", "Ward 5C"])).toBe("Ward 3A, Ward 4B and Ward 5C");
  });
});
