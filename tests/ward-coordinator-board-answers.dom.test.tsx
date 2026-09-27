// The setup file already loads these matchers; importing them here as well lets the commit-time
// per-file type check see them.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { dayOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Bed board answers, Josh, 26 September 2026: "go ahead with all recommendations" (decisions 1A to
 * 9A). This file covers the two that change this build's screens: 8A (Capacity gains "Discharges
 * due today" and "Transfers today") and 5A (an out-of-service bed says its reason is not recorded).
 */

/** An independent count, written here rather than borrowed from the derivation under test. */
function dueTodayByUnit(admissions: ReturnType<typeof seedWardFlowState>["admissions"], now: number) {
  const counts = new Map<string, number>();
  for (const admission of admissions) {
    if (!bedIsOccupied(admission) || admission.expectedDischargeAt === null) continue;
    if (dayOf(admission.expectedDischargeAt) !== dayOf(now)) continue;
    counts.set(admission.unitId, (counts.get(admission.unitId) ?? 0) + 1);
  }
  return counts;
}

describe("8A: discharges due today and transfers today on Capacity", () => {
  it.each(["standard", "scarce"] as const)(
    "counts each ward's stays due to leave today from the discharge record (%s seed)",
    (scenario) => {
      const state = seedWardFlowState(scenario);
      const rows = networkWardRows(state.units, NOW_ANCHOR, state.bedReleases, state.admissions, state.leaveBeds);
      const expected = dueTodayByUnit(state.admissions, NOW_ANCHOR);
      expect(rows.length).toBeGreaterThan(10);
      for (const row of rows) {
        expect(row.dischargesDueToday, row.unit.id).toBe(expected.get(row.unit.id) ?? 0);
      }
    },
  );

  it("says the figure is not known, never 0, when the screen was not given the admissions", () => {
    const state = seedWardFlowState();
    for (const row of networkWardRows(state.units, NOW_ANCHOR, state.bedReleases)) {
      expect(row.dischargesDueToday, row.unit.id).toBeUndefined();
    }
  });

  function MoveOneDischargeToToday({ admissionId, unitId }: { admissionId: string; unitId: string }) {
    const { dispatch, now } = useWardFlow();
    return (
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "UPDATE_EXPECTED_DISCHARGE",
            role: "ward",
            now,
            admissionId,
            actingUnitId: unitId,
            expectedDischargeAt: now + 120,
          })
        }
      >
        move one discharge to today
      </button>
    );
  }

  it("shows both columns, raises the ward's figure when a stay's discharge date moves to today, and never numbers transfers", () => {
    const state = seedWardFlowState();
    const person = state.admissions.find(
      (a) =>
        bedIsOccupied(a) && (a.expectedDischargeAt === null || dayOf(a.expectedDischargeAt) !== dayOf(NOW_ANCHOR)),
    );
    if (!person) throw new Error("the seed has nobody in a bed who is not already due today");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <MoveOneDischargeToToday admissionId={person.id} unitId={person.unitId} />
      </WardFlowProvider>,
    );

    const table = screen.getByTestId("ward-capacity-network-table");
    expect(within(table).getByRole("columnheader", { name: "Discharges due today" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Transfers today" })).toBeInTheDocument();

    const row = () => screen.getByTestId(`ward-capacity-network-row-${person.unitId}`);
    const cellValue = () => {
      const text = within(row()).getByTestId("ward-capacity-network-discharges-due-today").textContent ?? "";
      return text === "none" ? 0 : Number(text);
    };
    const before = cellValue();
    expect(Number.isFinite(before), "the cell is not a count or 'none'").toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "move one discharge to today" }));
    expect(cellValue()).toBe(before + 1);

    const transferCells = within(table).getAllByTestId("ward-capacity-network-transfers-today");
    expect(transferCells.length).toBe(state.units.length);
    for (const cell of transferCells) expect(cell).toHaveTextContent(/^Not recorded$/u);
  });
});

describe("5A: an out-of-service bed says its reason is not recorded", () => {
  it("the bed board's out-of-service line says so, on a ward that has one", () => {
    // The seed has no ward with a bed out of service since the owner ruling of 25 Sept 2026
    // ("Not recorded" unless a record backs it; demo-final-v3 set the four typed counts to 0). A
    // ward is given one typed out-of-service bed for this test only, and put back afterwards. The
    // seed copies the ward when the provider mounts, so the count is in place before the render.
    expect(seedWardFlowState().units.some((candidate) => candidate.blocked > 0)).toBe(false);
    const ward = unitById("rph-adult-secure");
    if (!ward) throw new Error("rph-adult-secure is missing from the sample network");
    const saved = ward.blocked;
    ward.blocked = 1;
    try {
      render(
        <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
          <WardBoard unitId={ward.id} />
        </WardFlowProvider>,
      );
      expect(
        screen.getAllByText("Out of service. Reason not recorded. No return date recorded.").length,
      ).toBeGreaterThan(0);
    } finally {
      ward.blocked = saved;
    }
  });
});
