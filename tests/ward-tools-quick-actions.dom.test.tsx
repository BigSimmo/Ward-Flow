import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
  window.localStorage.clear();
});

function atDesk(access: WardAccess) {
  act(() => setWardFeatureFlagOnDevice("role-access", true));
  act(() => setWardAccess(access));
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardToolsSheet isPhone={false} roleLabel="Desk" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
    </WardFlowProvider>,
  );
}

describe("Coordinator Quick actions (Josh, 3 Nov 2026)", () => {
  it("is one Tools row that opens six actions, Ward updates first, with nothing pre-selected", () => {
    atDesk({ role: "coordinator", scope: { kind: "statewide" } });
    fireEvent.click(screen.getByTestId("ward-tools-toggle-quick-actions"));
    const group = screen.getByRole("group", { name: "Quick actions" });
    const names = ["Ward updates", "Find a bed", "Bed summary", "Chase wards", "Ask wards", "Broadcast"];
    for (const name of names) expect(within(group).getByText(name)).toBeTruthy();
    expect(within(group).getByRole("button", { name: /Ward updates/u })).toHaveAttribute("aria-pressed", "true");

    const panel = screen.getByRole("region", { name: "Ward updates" });
    for (const box of within(panel).queryAllByRole("checkbox")) expect(box).not.toBeChecked();
    // Sending is not wired yet, and says so.
    expect(within(panel).getByRole("button", { name: /^Ask (all )?\d+ wards? to confirm$/u })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("lists every unconfirmed ward, behind Show more when there are many, so each can be picked", () => {
    atDesk({ role: "coordinator", scope: { kind: "statewide" } });
    fireEvent.click(screen.getByTestId("ward-tools-toggle-quick-actions"));
    const panel = screen.getByRole("region", { name: "Ward updates" });
    const [, confirmed, all] = /(\d+) of (\d+)/u.exec(panel.textContent ?? "") ?? [];
    const total = Number(all) - Number(confirmed);
    const more = within(panel).queryByRole("button", { name: /^Show \d+ more$/u });
    if (more) {
      expect(within(panel).getAllByRole("checkbox").length).toBe(8);
      fireEvent.click(more);
    }
    expect(within(panel).getAllByRole("checkbox").length).toBe(total);
  });

  it("is offered only to the coordinator", () => {
    atDesk({ role: "ed", scope: { kind: "ed", edId: "peel-ed" } });
    expect(screen.queryByTestId("ward-tools-toggle-quick-actions")).toBeNull();
  });
});
