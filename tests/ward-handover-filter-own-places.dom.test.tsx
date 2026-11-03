import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  return openScopeMenu();
}

/** Opens the Show menu and reads its groups: each heading and the choices listed under it. */
function openScopeMenu(): Map<string, string[]> {
  fireEvent.click(screen.getByRole("button", { name: /^Filter the sheet:/ }));
  const menu = screen.getByRole("menu", { name: "Filter the sheet" });
  const groups = new Map<string, string[]>();
  let heading = "";
  for (const node of Array.from(menu.children)) {
    if (node.getAttribute("role") === "presentation") {
      heading = node.textContent ?? "";
      groups.set(heading, []);
    } else if (heading) groups.get(heading)!.push(node.textContent ?? "");
  }
  return groups;
}

describe("handover filter offers only the desk's own places (issues #802, #815)", () => {
  it("a ward desk is offered its own wards and no other ward", () => {
    const groups = renderAtDesk({
      role: "ward",
      scope: { kind: "ward", unitIds: ["brm-adult-secure", "bun-adult-open"] },
    });
    expect(groups.get("Ward")).toHaveLength(2);
    expect(screen.getByRole("menuitemradio", { name: "Mabu Liyan / Broome Mental Health Unit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Bunbury Acute Psychiatric Unit" })).toBeInTheDocument();
    // A group the desk may not read is left out, heading and all.
    expect(groups.get("Community team") ?? []).toHaveLength(0);
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
    expect(screen.queryByRole("button", { name: /^Filter the sheet:/ })).toBeNull();
  });

  it("a statewide coordinator keeps every ward", () => {
    const groups = renderAtDesk({ role: "coordinator", scope: { kind: "statewide" } });
    expect(groups.get("Ward")!.length).toBeGreaterThan(5);
  });
});
