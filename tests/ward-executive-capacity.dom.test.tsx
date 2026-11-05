import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({
  operational: vi.fn(() => {
    throw new Error("Executive capacity read operational rows");
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "executive", scope: { kind: "statewide" } }),
}));
// The signed-in executive has no operational provider (WF-06): any read of one fails the test.
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/ward-flow-provider")>()),
  useWardFlow: guard.operational,
  useWardFlowSelect: guard.operational,
  useWardFlowClock: guard.operational,
}));

import { CapacityRoute } from "../src/components/ward-management/capacity/capacity-route";
import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const state = seedWardFlowState();
const data = projectExecutiveReportingFoundation(
  state,
  { role: "executive", scope: { kind: "statewide" } },
  {
    now: NOW_ANCHOR,
    dayZero: "2026-09-22T16:00:00.000Z",
    startedAt: "2026-10-23T02:42:00.000Z",
    places: wardPlaceLookup(state.units),
  },
);
const binding = { actorId: "synthetic-report-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Capacity for a signed-in executive (WF-06)", () => {
  it("loads from the aggregate report, without the operational workspace", () => {
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: structuredClone(data) }}
        now={150}
        controls={{ executive: true, paused: false, togglePause: null }}
      >
        <CapacityRoute />
      </ExecutiveStatisticsProvider>,
    );
    expect(screen.getByTestId("ward-capacity-executive")).toHaveTextContent(/beds ready of/u);
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    expect(screen.getByRole("table", { name: /Beds by ward/u })).toBeInTheDocument();
    expect(screen.getByTestId("ward-capacity-executive-as-at")).toHaveTextContent(/^As at /u);
    expect(screen.getByTestId("ward-capacity-executive-as-at")).not.toHaveTextContent(/paused/u);
    expect(screen.getByTestId("ward-capacity-executive-footer")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("marks a paused report beside its as-at time", () => {
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: structuredClone(data) }}
        now={150}
        controls={{ executive: true, paused: true, togglePause: null }}
      >
        <CapacityRoute />
      </ExecutiveStatisticsProvider>,
    );
    expect(screen.getByTestId("ward-capacity-executive-as-at")).toHaveTextContent(/report paused/u);
  });

  it("says the figures are unavailable when the report is absent", () => {
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={null}
        now={150}
        controls={{ executive: true, paused: false, togglePause: null }}
      >
        <CapacityRoute />
      </ExecutiveStatisticsProvider>,
    );
    expect(screen.queryByTestId("ward-capacity-executive")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-unavailable")).toHaveTextContent(/Statistics are unavailable/u);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByTestId("ward-capacity-executive-footer")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });
});
