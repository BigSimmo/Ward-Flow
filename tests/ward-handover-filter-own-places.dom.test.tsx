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
  return screen.getByRole("combobox", { name: "Filter the sheet" });
}

describe("handover filter offers only the desk's own places (issues #802, #815)", () => {
  it("a ward desk is offered its own wards and no other ward", () => {
    const select = renderAtDesk({
      role: "ward",
      scope: { kind: "ward", unitIds: ["brm-adult-secure", "bun-adult-open"] },
    });
    const wards = within(select)
      .getAllByRole("group")
      .find((group) => group.getAttribute("label") === "Ward");
    expect(wards?.querySelectorAll("option")).toHaveLength(2);
    expect(within(select).getByRole("option", { name: "Mabu Liyan / Broome Mental Health Unit" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Bunbury Acute Psychiatric Unit" })).toBeInTheDocument();
    const teams = within(select)
      .getAllByRole("group")
      .find((group) => group.getAttribute("label") === "Community team");
    expect(teams?.querySelectorAll("option")).toHaveLength(0);
  });

  // Approved redesign (Josh, 31 Oct 2026): a one-ward desk is the nurse in charge's own sheet, so
  // there is nothing to filter and no picker at all.
  it("a one-ward desk has no scope picker", () => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["brm-adult-secure"] } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAccessScope>
          <HandoverPage />
        </WardAccessScope>
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("combobox", { name: "Filter the sheet" })).toBeNull();
  });

  it("a statewide coordinator keeps every ward", () => {
    const select = renderAtDesk({ role: "coordinator", scope: { kind: "statewide" } });
    const wards = within(select)
      .getAllByRole("group")
      .find((group) => group.getAttribute("label") === "Ward");
    expect(wards!.querySelectorAll("option").length).toBeGreaterThan(5);
  });
});
