import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart",
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
  // Audit two #117 (27 Nov 2026): the Quick actions tile grid is gone for every desk but the coordinator's;
  // each desk's tools stay as rows, so what a desk is given is read from the rows' names.
  return [...document.querySelectorAll("strong")].map((name) => (name.textContent ?? "").trim());
}

// Quick actions for every desk (Josh approved the mock-up and all 7 recommendations, 4 Nov 2026).
describe("Quick actions for every desk", () => {
  afterEach(() => {
    act(() => setWardFeatureFlagOnDevice("role-access", null));
    resetWardAccessStoreForTests();
  });

  // Audit two #117 (27 Nov 2026): the tiles that were only borrowed into the grid (Confirm beds, Referrals in,
  // My jobs, Alerts, Broadcast) went with it; each desk keeps its own rows, which are checked here.
  it("gives the nurse in charge Due back and the ward's own rows", () => {
    const tiles = tilesAt({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    expect(tiles).toEqual(
      expect.arrayContaining(["Due back", "Update a bed", "Record a delay", "Remind me", "Record transport booking"]),
    );
    expect(tiles).not.toContain("Broadcast");
  });

  it("gives the ED Find a bed, transport booking and form times", () => {
    const tiles = tilesAt({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } });
    expect(tiles).toEqual(expect.arrayContaining(["Find a bed", "Record transport booking", "Form times", "On-call"]));
  });

  it("gives the community team Suburb lookup and legal forms", () => {
    const tiles = tilesAt({ role: "community", scope: { kind: "team", teamName: "Midland" } });
    expect(tiles).toEqual(expect.arrayContaining(["Suburb lookup", "Legal forms"]));
  });

  it("gives the transport officer On-call and Remind me, and no network bed figures", () => {
    const tiles = tilesAt({ role: "officer", scope: { kind: "jobs" } });
    expect(tiles).toEqual(expect.arrayContaining(["On-call", "Remind me"]));
    expect(tiles).not.toContain("Find a bed");
    expect(tiles).not.toContain("Key figures");
  });

  it("gives the site bed manager its wards' rows, without Record a delay", () => {
    const tiles = tilesAt({ role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } });
    expect(tiles).toEqual(expect.arrayContaining(["Update a bed", "Due back", "Hospital feed"]));
    // The bed manager may not record a delay (Q97), so that row drops out.
    expect(tiles).not.toContain("Record a delay");
  });

  it("keeps borrowed tiles to a short second line for phones", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } }));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet isPhone roleLabel="Desk" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
      </WardFlowProvider>,
    );
    // Audit two #117: with no tile grid, a row's second line is its own short detail.
    for (const line of [...document.querySelectorAll("em")]) {
      expect((line.textContent ?? "").trim().split(/\s+/u).length).toBeLessThanOrEqual(6);
    }
  });
});
