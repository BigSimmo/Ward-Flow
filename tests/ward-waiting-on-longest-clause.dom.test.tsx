import { readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/" }));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { BED_RELEASE_WAITING_ON } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ═══ OWNER RULING R7, 2026-09-06 — ONE HOLD-UP, AND THE SCREEN MUST SAY WHICH ONE ═══
 *
 * He confirmed a ward is routinely waiting on more than one thing, and chose to keep recording
 * exactly ONE — *"defined as the one that will take longest. Say so on screen, or a reader will
 * think the others are unknown."*
 *
 * ⚠️ **THE DISTINCTION IS UNRECORDED VERSUS UNKNOWN.** A single value with no explanation reads as
 * the ward's complete answer; it is the ward's LONGEST answer. Silence here would make the screen
 * state something more definite than the data supports — the same class as the referral banner that
 * said "right now" about a shortage that was never about beds.
 *
 * ⚠️ **AND R6's TWO NEW ENTRIES MUST ACTUALLY REACH THE PICKER.** A list extended in the model and
 * not offered on screen is the shape this project keeps finding: complete, tested, unreachable.
 */

const unitId = allUnits()[0]?.id ?? "";

function renderWard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the waiting-on clause on the discharges list", () => {
  it("does not bring the waiting-on picker back onto the ward screen", () => {
    renderWard();
    expect(screen.queryByLabelText(/^Waiting on$/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-bed-release-waiting-on-hint")).not.toBeInTheDocument();
    // The owner's list still exists. A picker that offered a shorter list was the old defect.
    // This screen no longer asks the question; it shows the value already recorded.
    expect(BED_RELEASE_WAITING_ON).toContain("Awaiting legal or Mental Health Act process");
    expect(BED_RELEASE_WAITING_ON).toContain("Awaiting transport");
  });

  it("says the recorded one is the LONGEST, so a reader does not read it as the only one", () => {
    renderWard();
    const hint = screen.getByTestId("ward-waiting-on-longest");
    expect(hint).toHaveTextContent(/the one that will take longest/i);
    expect(hint).toHaveTextContent(/often waiting on several/i);
  });

  it("declares the clause once and renders that same sentence", () => {
    const source = readFileSync("src/components/ward-management/ward/ward-discharges-matrix.tsx", "utf8");
    const declarations = source.match(/const WAITING_ON_LONGEST\b/gu) ?? [];
    const uses = source.match(/\{WAITING_ON_LONGEST\}/gu) ?? [];
    expect(declarations, "the clause is declared more than once, so the wording can drift").toHaveLength(1);
    expect(uses, "the clause is declared and never shown").toHaveLength(1);

    renderWard();
    expect(screen.getAllByText(/the one that will take longest/i)).toHaveLength(1);
  });

  it("keeps the clause on the discharges list, not on the decisions queue", () => {
    renderWard();
    const hint = screen.getByTestId("ward-waiting-on-longest");
    expect(hint.closest("#tab-out")).not.toBeNull();
    expect(document.getElementById("tab-return")?.textContent ?? "").not.toMatch(/the one that will take longest/i);
    cleanup();
  });
});
