import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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

function renderAtDesk(access: WardAccess) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <HandoverPage />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

// Role branches of the one Handover page (approved redesign, Josh, 31 Oct 2026).
describe("Handover role branches", () => {
  it("the nurse in charge's one-ward desk counts people and drops the coordinator's bed search", () => {
    renderAtDesk({ role: "ward", scope: { kind: "ward", unitIds: ["brm-adult-secure"] } });
    expect(screen.getByRole("heading", { level: 1, name: /\d+ (person|people) to hand over/ })).toBeInTheDocument();
    const counts = within(screen.getByTestId("ward-handover-kpi-strip"));
    expect(counts.queryByText("Finding a ward")).toBeNull();
    const sheet = within(screen.getByTestId("ward-handover-sheet"));
    // FD-23: Declined and Escalated belong to the coordinator's bed search.
    expect(sheet.queryByRole("button", { name: /^Declined/ })).toBeNull();
    expect(sheet.queryByRole("button", { name: /^Escalated/ })).toBeNull();
    expect(sheet.getByRole("button", { name: /^Constant obs/ })).toBeInTheDocument();
  });

  it("the ED clinician's desk names its own department, has no Beds tab and never signs off", () => {
    renderAtDesk({ role: "ed", scope: { kind: "ed", edId: "peel-ed" } });
    expect(screen.getByTestId("ward-handover-page")).toHaveTextContent("Peel ED");
    expect(screen.queryByRole("tab", { name: /Beds/ })).toBeNull();
    expect(screen.getByTestId("ward-handover-sign-off-note")).toHaveTextContent("Coordinator or ward signs off");
    expect(screen.queryByTestId("ward-handover-sign-off")).toBeNull();
    expect(screen.queryByTestId("ward-handover-sign-bar")).toBeNull();
    expect(screen.queryByTestId("ward-handover-hero-sign-off")).toBeNull();
    expect(screen.queryByText(/finding a ward$/)).toBeNull();
  });

  it("the coordinator keeps the scope picker, the bed meter and the sign-off", () => {
    renderAtDesk({ role: "coordinator", scope: { kind: "statewide" } });
    expect(screen.getByRole("combobox", { name: "Filter the sheet" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Beds/ })).toBeInTheDocument();
    expect(screen.getByTestId("ward-handover-sign-off")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-sign-off-note")).toBeNull();
  });
});
