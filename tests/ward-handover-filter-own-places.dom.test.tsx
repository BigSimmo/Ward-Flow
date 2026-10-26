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
  it("a ward desk is offered its own ward and no other ward", () => {
    const select = renderAtDesk({ role: "ward", scope: { kind: "ward", unitIds: ["brm-adult-secure"] } });
    const wards = within(select)
      .getAllByRole("group")
      .find((group) => group.getAttribute("label") === "Ward");
    expect(wards?.querySelectorAll("option")).toHaveLength(1);
    expect(within(select).getByRole("option", { name: "Mabu Liyan / Broome Mental Health Unit" })).toBeInTheDocument();
    const teams = within(select)
      .getAllByRole("group")
      .find((group) => group.getAttribute("label") === "Community team");
    expect(teams?.querySelectorAll("option")).toHaveLength(0);
  });

  it("a statewide coordinator keeps every ward", () => {
    const select = renderAtDesk({ role: "coordinator", scope: { kind: "statewide" } });
    const wards = within(select)
      .getAllByRole("group")
      .find((group) => group.getAttribute("label") === "Ward");
    expect(wards!.querySelectorAll("option").length).toBeGreaterThan(5);
  });
});
