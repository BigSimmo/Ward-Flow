import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as `ward-discharge-board.dom.test.tsx`: `DischargeBoard` renders a next/link anchor
// (the "Open full ward" footer link) and this suite never checks routing.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
    </WardFlowProvider>,
  );
}

// v10 (10 Oct 2026): the build guide replaced the hero's Plan departure with the Ready to leave
// checklist in the release panel. Departure planning stays on the ward's own Decisions tab.
describe("departure readiness lives in the release panel", () => {
  it("has no Plan departure in the hero, and a release opens with Ready to leave and Undo", () => {
    renderBoard();
    expect(screen.queryByTestId("ward-discharge-plan-departure")).toBeNull();
    const blockedRow = document.querySelector<HTMLElement>('tr[data-act="true"]');
    expect(blockedRow).not.toBeNull();
    fireEvent.click(blockedRow!);
    const ready = screen.getByTestId("ward-discharge-ready-to-leave");
    const item = within(ready).getByTestId("ward-discharge-ready-medicines");
    const before = item.getAttribute("aria-pressed");
    fireEvent.click(item);
    expect(item.getAttribute("aria-pressed")).not.toBe(before);
    fireEvent.click(within(screen.getByTestId("ward-discharge-ready-toast")).getByRole("button", { name: "Undo" }));
    expect(item.getAttribute("aria-pressed")).toBe(before);
  });

  it("never renders the excluded barrier option or the false census/invariant claim", () => {
    renderBoard();

    // BED_RELEASE_BLOCKERS (ward-change-reasons.ts) does not accept this reason — the removed
    // dialog offered it anyway. Assert on the whole document, not a dialog root, because the
    // point being proven is that no such option exists ANYWHERE any more.
    expect(document.body.textContent).not.toContain("State Administrative Tribunal (SAT) Guardianship");
    expect(document.body.textContent).not.toContain("Preserves invariant I-05");
    expect(document.body.textContent).not.toContain("Save departure forecast");
  });
});

/**
 * Ward audit 2026-09-16, fix 2 continued: the four KPI-strip sub-captions ("NDIS / Housing /
 * Transport", "Departure times fixed", "Medical review pending", "Beds returned to network") were
 * typed text unconnected to the count above them. "Confirmed today" and "Discharged today" claimed
 * a calendar-day scope neither bucket enforces (the release table caption already says the
 * discharged bucket is a rolling last-24-hours window). "Blocked releases" kept the releases noun
 * even in the admission-records view.
 */
describe("the discharge board's KPI captions no longer assert what the count does not show", () => {
  it("never renders any of the four invented sub-captions", () => {
    renderBoard();

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("NDIS / Housing / Transport");
    expect(text).not.toContain("Departure times fixed");
    expect(text).not.toContain("Medical review pending");
    expect(text).not.toContain("Beds returned to network");
  });

  it("titles the releases-view KPI cards for the releases population, with no day claim", () => {
    renderBoard();

    // "Confirmed"/"Expected" also label per-row badges elsewhere on the board, so each assertion
    // is scoped to its own KPI card (by the testid added alongside this fix) rather than matched
    // against the whole document.
    expect(within(screen.getByTestId("ward-discharge-kpi-blocked")).getByText("Blocked releases")).toBeInTheDocument();
    // "Confirmed today"/"Discharged today"/"Expected on round" are gone — none of the three
    // buckets is scoped to a calendar day or an invented "round" workflow.
    expect(screen.queryByText("Confirmed today")).not.toBeInTheDocument();
    expect(screen.queryByText("Discharged today")).not.toBeInTheDocument();
    expect(screen.queryByText("Expected on round")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("ward-discharge-kpi-confirmed")).getByText("Confirmed")).toBeInTheDocument();
    expect(within(screen.getByTestId("ward-discharge-kpi-expected")).getByText("Expected")).toBeInTheDocument();
    // Reused verbatim from the status-filter button, which already renders this exact phrase for
    // the same releases/departed pair.
    expect(within(screen.getByTestId("ward-discharge-kpi-departed")).getByText("Discharged · 24h")).toBeInTheDocument();
  });

  it("retitles the KPI cards to the records population once the population switch is used", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /^History/ }));

    // Before this fix these two cards still read "Blocked releases" / "Discharged · 24h"
    // while counting admission records, not releases.
    expect(within(screen.getByTestId("ward-discharge-kpi-blocked")).getByText("Blocked records")).toBeInTheDocument();
    expect(within(screen.getByTestId("ward-discharge-kpi-blocked")).queryByText("Blocked releases")).toBeNull();
    expect(within(screen.getByTestId("ward-discharge-kpi-departed")).getByText("Departed")).toBeInTheDocument();
    expect(within(screen.getByTestId("ward-discharge-kpi-departed")).queryByText("Discharged · 24h")).toBeNull();
    expect(within(screen.getByTestId("ward-discharge-kpi-confirmed")).getByText("Confirmed")).toBeInTheDocument();
    expect(within(screen.getByTestId("ward-discharge-kpi-expected")).getByText("Expected")).toBeInTheDocument();
  });
});
