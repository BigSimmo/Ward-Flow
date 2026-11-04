import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function tilesAt(access: WardAccess, isPhone = false): string[] {
  act(() => setWardFeatureFlagOnDevice("role-access", true));
  act(() => setWardAccess(access));
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardToolsSheet isPhone={isPhone} roleLabel="Desk" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-tools-toggle-quick-actions"));
  const grid = screen.getByRole("group", { name: "Quick actions" });
  // Tiles that work here lead; shortcuts that leave Tools sit apart as pill links (round 3).
  const here = [...grid.querySelectorAll("button")].map((tile) => tile.querySelector("strong")?.textContent ?? "");
  const away = [...grid.querySelectorAll("a")].map((link) => link.querySelector("span")?.textContent ?? "");
  return [...here, ...away];
}

// Quick actions for every desk (Josh approved the mock-up and all 7 recommendations, 4 Nov 2026).
describe("Quick actions for every desk", () => {
  afterEach(() => {
    act(() => setWardFeatureFlagOnDevice("role-access", null));
    resetWardAccessStoreForTests();
  });

  it("gives the nurse in charge Confirm beds first, then Due back and the ward's own rows", () => {
    const tiles = tilesAt({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    expect(tiles).toEqual(
      expect.arrayContaining(["Confirm beds", "Due back", "Update a bed", "Log a delay", "Remind me"]),
    );
    expect(tiles).not.toContain("Broadcast");
  });

  it("gives the ED New referral and Find a bed", () => {
    const tiles = tilesAt({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } });
    expect(tiles).toEqual(
      expect.arrayContaining(["New referral", "Find a bed", "Book transport", "Form times", "On-call"]),
    );
  });

  it("gives the community team Referrals in and Suburb lookup", () => {
    const tiles = tilesAt({ role: "community", scope: { kind: "team", teamName: "Midland" } });
    expect(tiles).toEqual(expect.arrayContaining(["Referrals in", "New referral", "Suburb lookup"]));
  });

  it("gives the transport officer My jobs and Alerts, and no network bed figures", () => {
    const tiles = tilesAt({ role: "officer", scope: { kind: "jobs" } });
    expect([...tiles].sort()).toEqual(["Alerts", "My jobs", "On-call", "Remind me"]);
    expect(tiles).not.toContain("Find a bed");
  });

  it("gives the site bed manager Broadcast for its wards", () => {
    const tiles = tilesAt({ role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } });
    expect(tiles).toEqual(expect.arrayContaining(["Update a bed", "Due back", "Broadcast"]));
    // The bed manager may not record a delay (Q97), so that tile drops out with its row.
    expect(tiles).not.toContain("Log a delay");
  });

  it("keeps borrowed tiles to a short second line for phones", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } }));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet isPhone roleLabel="Desk" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-tools-toggle-quick-actions"));
    const grid = screen.getByRole("group", { name: "Quick actions" });
    for (const line of within(grid).getAllByText((_t, el) => el?.tagName === "EM")) {
      expect((line.textContent ?? "").trim().split(/\s+/u).length).toBeLessThanOrEqual(4);
    }
  });
});
