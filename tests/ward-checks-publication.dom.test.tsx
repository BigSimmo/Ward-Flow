import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { resetWardChecksForTests } from "@/components/ward-management/shell/ward-checks";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * **OWNER DECISION O-9 — a screen tells the shell what it reconciled, end to end.**
 *
 * 🔴 **THE PROPERTY THAT MATTERS IS NOT "IT PUBLISHES". IT IS THAT THREE STATES STAY THREE.**
 * Before O-9, *no screen has published* and *this screen published an empty list* were the same
 * empty array and rendered identically, and owner ruling D-40 exists because the second of those
 * must never read as agreement. **A union cannot be flattened by `??`; an array can.**
 *
 * ⚠️ **These render the REAL shell against the REAL screen.** A test that called the store directly
 * would prove the store works and nothing about whether the rail is wired to it — which is the half
 * that was missing for the entire life of this mechanism's design.
 */
afterEach(() => {
  resetWardChecksForTests();
});

function renderRailAlone() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardRail />
    </WardFlowProvider>,
  );
}

function renderRailBelowScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardRail />
      <MovementsScreen />
    </WardFlowProvider>,
  );
}

describe("a ward screen publishes its checks upward to the shell", () => {
  it("keeps the rail quiet when no screen has published checks", () => {
    renderRailAlone();
    expect(
      screen.queryByTestId("ward-reconciliation-line"),
      "the rail claims something about reconciliation with no screen on the page at all",
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No reconciliation is available for this page yet.")).not.toBeInTheDocument();
  });

  it("also keeps the collapsed rail quiet when no screen has published checks", () => {
    window.localStorage.setItem("ward-flow-rail", "closed");
    try {
      renderRailAlone();
      expect(screen.queryByTestId("ward-reconciliation-line")).not.toBeInTheDocument();
    } finally {
      window.localStorage.removeItem("ward-flow-rail");
    }
  });

  /**
   * 🔴 **THE ASSERTION THE WHOLE MECHANISM EXISTS FOR.** Until O-9 the rail was given `[]` by the
   * layout on every route, forever, because no screen could hand it anything.
   *
   * ⚠️ **THIS COMMENT SAID IT PROVED "a fact travelled from a DESCENDANT to an ANCESTOR". IT DOES
   * NOT, AND NEITHER DOES THE APP.** `layout.tsx` renders the rail and the bar as SIBLINGS of the
   * screen, and so does the helper below. **What this proves is that a fact travelled BETWEEN
   * SIBLINGS through a module store** — which is the harder case, not the easier one: siblings
   * cannot pass props in either direction.
   */
  it("reflects the screen's own check once that screen is mounted", () => {
    renderRailBelowScreen();
    const line = screen.getByTestId("ward-reconciliation-line");

    expect(
      line,
      "the rail still reports nothing published while a screen that publishes is on the page — the " +
        "screen and the shell are not connected",
    ).not.toHaveTextContent("No reconciliation is available for this page yet.");
    expect(line).toHaveTextContent("Invented figures, reconciled with each other.");
    expect(line).toHaveAttribute("data-tone", "good");
  });

  /**
   * ⚠️ **THE CLEARING HALF, AND IT IS THE ONE THAT KEEPS THE SHELL HONEST.** Without it a screen's
   * passing claim would stand on the NEXT route — a reconciliation sentence about a page the reader
   * has already left. **A stale TRUE claim is worse than no claim: it is the shape nobody checks.**
   */
  it("stops claiming the screen's reconciliation once that screen unmounts", () => {
    const { unmount } = renderRailBelowScreen();
    expect(screen.getByTestId("ward-reconciliation-line")).toHaveTextContent("reconciled with each other");
    unmount();

    renderRailAlone();
    expect(
      screen.queryByTestId("ward-reconciliation-line"),
      "the previous screen's claim survived its own unmount and is now being made about a different page",
    ).not.toBeInTheDocument();
  });
});
