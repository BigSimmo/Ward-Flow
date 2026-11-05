import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
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

/** Writes the live broadcasts' target wards into the page, so a test can read what was sent. */
function SentProbe() {
  const { broadcastAlerts } = useWardFlowSelect("broadcastAlerts");
  return (
    <output data-testid="sent">
      {JSON.stringify(broadcastAlerts.map((alert) => ({ title: alert.title, units: alert.targetUnitIds ?? null })))}
    </output>
  );
}

function sentAsks(): { title: string; units: string[] | null }[] {
  const all = JSON.parse(screen.getByTestId("sent").textContent || "[]") as { title: string; units: string[] | null }[];
  return all.filter((alert) => alert.title === "Please confirm your beds");
}

function atDesk(access: WardAccess) {
  act(() => setWardFeatureFlagOnDevice("role-access", true));
  act(() => setWardAccess(access));
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardToolsSheet isPhone={false} roleLabel="Desk" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
      <SentProbe />
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
    expect(within(panel).getByRole("button", { name: /^Ask (all )?\d+ wards? to confirm$/u })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("sends the ask to every unconfirmed ward when none is ticked, once, and says so", async () => {
    atDesk({ role: "coordinator", scope: { kind: "statewide" } });
    fireEvent.click(screen.getByTestId("ward-tools-toggle-quick-actions"));
    const panel = screen.getByRole("region", { name: "Ward updates" });
    const more = within(panel).queryByRole("button", { name: /^Show \d+ more$/u });
    if (more) fireEvent.click(more);
    const waiting = within(panel).getAllByRole("checkbox").length;
    const ask = within(panel).getByRole("button", { name: /^Ask (all )?\d+ wards? to confirm$/u });
    expect(sentAsks()).toHaveLength(0);
    // Two quick taps send one ask.
    await act(async () => {
      fireEvent.click(ask);
      fireEvent.click(ask);
    });
    const asks = sentAsks();
    expect(asks).toHaveLength(1);
    expect(asks[0].units).toHaveLength(waiting);
    expect(within(panel).getByRole("status")).toHaveTextContent(
      new RegExp(`^Asked ${waiting} wards?\\. It shows on their screen for 4 hours\\.`, "u"),
    );
    expect(within(panel).getByRole("link", { name: "Open Alerts" })).toHaveAttribute("href", "/ward-flow/alerts");
  });

  it("sends only to the wards ticked, then clears the ticks", async () => {
    atDesk({ role: "coordinator", scope: { kind: "statewide" } });
    fireEvent.click(screen.getByTestId("ward-tools-toggle-quick-actions"));
    const panel = screen.getByRole("region", { name: "Ward updates" });
    const boxes = within(panel).getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    const ask = within(panel).getByRole("button", { name: "Ask 1 ward to confirm" });
    await act(async () => {
      fireEvent.click(ask);
    });
    const asks = sentAsks();
    expect(asks).toHaveLength(1);
    expect(asks[0].units).toHaveLength(1);
    expect(within(panel).getByRole("status")).toHaveTextContent(
      /^Asked 1 ward\. It shows on their screen for 4 hours\./u,
    );
    for (const box of within(panel).getAllByRole("checkbox")) expect(box).not.toBeChecked();
  });

  it("skips a ward asked in the last 4 hours, so a second press never nags it", async () => {
    atDesk({ role: "coordinator", scope: { kind: "statewide" } });
    fireEvent.click(screen.getByTestId("ward-tools-toggle-quick-actions"));
    const panel = screen.getByRole("region", { name: "Ward updates" });
    const before = within(panel).getByRole("button", { name: /^Ask (all )?\d+ wards? to confirm$/u }).textContent;
    fireEvent.click(within(panel).getAllByRole("checkbox")[0]);
    await act(async () => {
      fireEvent.click(within(panel).getByRole("button", { name: "Ask 1 ward to confirm" }));
    });
    // The same ward again: the button is off and says why, and a press sends nothing.
    fireEvent.click(within(panel).getAllByRole("checkbox")[0]);
    const again = within(panel).getByRole("button", { name: "Ask wards to confirm" });
    expect(again).toHaveAttribute("aria-disabled", "true");
    expect(panel).toHaveTextContent("Already asked in the last 4 hours.");
    await act(async () => {
      fireEvent.click(again);
    });
    expect(sentAsks()).toHaveLength(1);
    // With nothing ticked, the count leaves out the ward already asked.
    fireEvent.click(within(panel).getAllByRole("checkbox")[0]);
    const n = Number(/\d+/u.exec(before ?? "")?.[0] ?? 0);
    if (n > 1) {
      expect(
        within(panel).getByRole("button", { name: `Ask ${n - 1} ${n - 1 === 1 ? "ward" : "wards"} to confirm` }),
      ).toBeInTheDocument();
    }
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

  it("gives another desk its own tiles, never the coordinator's (Josh, 4 Nov 2026)", () => {
    atDesk({ role: "ed", scope: { kind: "ed", edId: "peel-ed" } });
    fireEvent.click(screen.getByTestId("ward-tools-toggle-quick-actions"));
    const grid = screen.getByRole("group", { name: "Quick actions" });
    for (const name of ["Ward updates", "Chase wards", "Ask wards", "Broadcast"]) {
      expect(within(grid).queryByText(name)).toBeNull();
    }
    expect(within(grid).getByText("New referral")).toBeTruthy();
  });
});
