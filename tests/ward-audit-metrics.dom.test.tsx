import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StatisticsCapacityChart } from "@/components/ward-management/statistics/statistics-capacity-chart";
import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { CensusDetail } from "@/components/ward-management/search/patient-census-view";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { DEFAULT_DUE_SOON_THRESHOLDS, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement, Unit } from "@/components/ward-management/ward-model";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

function unit(name: string, empty: number): Unit {
  const base = allUnits()[0];
  return {
    ...base,
    id: name,
    name,
    beds: 10,
    empty: { ...base.empty, value: empty },
    allocatable: { ...base.allocatable, value: empty },
  };
}

function ArrivalFixture({ stage, eta }: { stage: Movement["stage"]; eta: number }) {
  const live = useWardFlow();
  const unitId = live.units[0].id;
  const movement = {
    ...live.movements[0],
    acceptedUnitId: unitId,
    stage,
    arrivalDetails: { mode: "ambulance" as const, estimatedArrivalAt: eta, recordedAt: 0, recordedBy: "ward" as const },
    // Cleared, so the Notices badge counts only the late arrival this test is about.
    medicalClearance: { cleared: true, at: 0 },
    referredUnitIds: [],
    declines: [],
    withdrawnReferrals: [],
  };
  return (
    <WardFlowOverride
      value={{
        ...live,
        movements: [movement],
        refreshRequests: [],
        morningRollupConfirmations: {
          [unitId]: { confirmedAt: live.now, confirmedByRole: "ward", expectedDischarges: 0 },
        },
      }}
    >
      <WardScreen unitId={unitId} />
    </WardFlowOverride>
  );
}

describe("audit metrics rendered regressions", () => {
  it("R03 sorts by occupied plus pulled, matching displayed occupancy", () => {
    const alpha = unit("Alpha", 1); // 9 in use: 6 occupied + 3 pulled.
    const beta = unit("Beta", 2); // 8 occupied.
    const pulled = Array.from({ length: 3 }, (_, index): Admission => ({
      ...wardAdmissions[0],
      id: `AD-PULL-${index}`,
      unitId: alpha.id,
      state: "pulled",
      movementId: null,
    }));
    render(<StatisticsCapacityChart units={[alpha, beta]} bedReleases={[]} admissions={pulled} initialGroup="ward" />);
    fireEvent.click(screen.getByRole("button", { name: "Most ready" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Highest occupancy" }));
    const rows = screen.getAllByRole("button", { name: /occupied of 10 beds/ });
    expect(rows.map((row) => row.getAttribute("aria-label")?.split(":")[0])).toEqual(["Alpha", "Beta"]);
  });

  it("R08 pools stays across unequal ward populations and excludes wards outside the comparison", () => {
    const [alpha, beta, outside] = allUnits();
    const base = wardAdmissions[0];
    const admissions = [
      ...Array.from({ length: 3 }, (_, index): Admission => ({
        ...base,
        id: `AD-SHORT-${index}`,
        unitId: alpha.id,
        arrivedAt: NOW_ANCHOR - MINUTES_PER_DAY,
        leftAt: null,
        state: "occupied",
      })),
      {
        ...base,
        id: "AD-LONG",
        unitId: beta.id,
        arrivedAt: NOW_ANCHOR - 9 * MINUTES_PER_DAY,
        leftAt: null,
        state: "occupied" as const,
      },
      {
        ...base,
        id: "AD-OUTSIDE",
        unitId: outside.id,
        arrivedAt: NOW_ANCHOR - 100 * MINUTES_PER_DAY,
        leftAt: null,
        state: "occupied" as const,
      },
    ];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsCompareScreen units={[alpha, beta]} admissions={admissions} emergencyDepartments={[]} />
      </WardFlowProvider>,
    );
    expect(screen.getByText("Average stay", { selector: "span" }).parentElement).toHaveTextContent("3.0d");
  });

  it.each([
    ["arrived", -100, false],
    ["moving", -100, true],
    ["moving", 0, true],
    ["moving", NOW_ANCHOR, false],
  ] as const)("R13 notification count for %s with ETA %i is truthful", (stage, eta, late) => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ArrivalFixture stage={stage} eta={eta} />
      </WardFlowProvider>,
    );
    const badge = screen.queryByTestId("ward-notification-count-badge");
    if (late) expect(badge).toHaveTextContent("1");
    else expect(badge).toBeNull();
  });

  it("R27 labels same-day negative instants with their time and the earlier day as yesterday", () => {
    const seed = seedWardFlowState();
    const row = buildCensus({
      ...seed,
      now: -30,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      dayZero: new Date("2026-10-01T00:00:00+08:00"),
    }).rows[0];
    render(
      <CensusDetail
        row={{
          ...row,
          timeline: [
            { at: -60, glyph: "wait", text: "Same day event" },
            { at: -1500, glyph: "wait", text: "Previous day event" },
          ],
        }}
        now={-30}
        onCopy={() => {}}
        copyNote={null}
      />,
    );
    const timeline = within(screen.getByRole("list", { name: "Latest for this patient" }));
    expect(timeline.getByText("23:00")).toBeInTheDocument();
    expect(timeline.getAllByText("Yday")).toHaveLength(1);
  });
});
