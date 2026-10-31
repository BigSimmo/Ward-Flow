import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const current = vi.hoisted(() => ({
  pathname: "/ward-flow/statistics",
  role: "coordinator" as "coordinator" | "executive",
  operational: vi.fn(() => {
    throw new Error("Executive samples read operational rows");
  }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => current.pathname }));
vi.mock("../src/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: current.role, scope: { kind: "statewide" } }),
}));
vi.mock("../src/components/ward-management/ward-flow-provider", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/ward-flow-provider")>()),
  useWardFlow: current.operational,
  useUnscopedWardFlow: current.operational,
  useWardFlowSelect: current.operational,
  useWardFlowClock: current.operational,
}));
vi.mock("../src/components/ward-management/shell/ward-access-context", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-context")>()),
  useUnscopedWardFlow: current.operational,
}));

import { StatisticsSampleFigures } from "../src/components/ward-management/statistics/statistics-sample-figures";
import { setStatisticsSamples } from "../src/components/ward-management/statistics/statistics-samples";
import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import type { ExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
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
    startedAt: "2026-09-23T02:42:00.000Z",
    places: wardPlaceLookup(state.units),
  },
);
const binding = { actorId: "synthetic-sample-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };
function samples(report: ExecutiveReportingFoundation | null = data, now = 150) {
  return render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={report ? { binding, receivedAt: 100, expiresAt: 200, data: report } : null}
      now={now}
      controls={{ executive: true, paused: false, togglePause: null }}
    >
      <StatisticsSampleFigures />
    </ExecutiveStatisticsProvider>,
  );
}
afterEach(() => {
  cleanup();
  setStatisticsSamples(false);
  current.pathname = "/ward-flow/statistics";
  current.role = "coordinator";
  vi.clearAllMocks();
});

describe("executive sample chart data boundary", () => {
  it("fails closed for an actual executive without a host provider", () => {
    current.role = "executive";
    setStatisticsSamples(true);
    render(<StatisticsSampleFigures />);
    expect(screen.queryByTestId("statistics-sample-figures")).toBeNull();
    expect(current.operational).not.toHaveBeenCalled();
  });
  it("does not mount operational providers while Samples is off", () => {
    samples();
    expect(screen.queryByTestId("statistics-sample-figures")).toBeNull();
    expect(current.operational).not.toHaveBeenCalled();
  });
  it.each(["missing", "expired"])("fails closed for a %s report while Samples is on", (kind) => {
    setStatisticsSamples(true);
    samples(kind === "missing" ? null : data, kind === "expired" ? 200 : 150);
    expect(screen.queryByTestId("statistics-sample-figures")).toBeNull();
    expect(current.operational).not.toHaveBeenCalled();
  });
  it.each(["ward", "ed", "community", "service"])(
    "preserves labelled invented charts for an allowed %s using public measures only",
    (kind) => {
      const id =
        kind === "ward"
          ? data.wards[0].id
          : kind === "ed"
            ? data.openableEmergencyDepartmentIds[0]
            : kind === "community"
              ? data.openableCommunityTeamIds[0]
              : data.openableServiceIds[0];
      current.pathname = `/ward-flow/statistics/${kind}/${encodeURIComponent(id)}`;
      setStatisticsSamples(true);
      samples();
      const section = screen.getByTestId("statistics-sample-figures");
      expect(section).toHaveTextContent("Invented data · 30 days");
      expect(section.querySelectorAll('[data-figure-kind="sample"]')).toHaveLength(3);
      for (const line of section.querySelectorAll("polyline"))
        expect(line.getAttribute("points")).not.toMatch(/NaN|Infinity/);
      expect(current.operational).not.toHaveBeenCalled();
    },
  );
  it.each(["ward", "ed", "community", "service"])("does not invent a sample profile for an unknown %s", (kind) => {
    current.pathname = `/ward-flow/statistics/${kind}/synthetic-absent`;
    setStatisticsSamples(true);
    samples();
    expect(screen.queryByTestId("statistics-sample-figures")).toBeNull();
    expect(current.operational).not.toHaveBeenCalled();
  });
  it("does not use public origin groups as permission to open their foreign detail samples", () => {
    const scoped = structuredClone(data);
    scoped.openableEmergencyDepartmentIds = [];
    current.pathname = `/ward-flow/statistics/ed/${data.emergencyDepartments[0].id}`;
    setStatisticsSamples(true);
    samples(scoped);
    expect(screen.queryByTestId("statistics-sample-figures")).toBeNull();
    expect(current.operational).not.toHaveBeenCalled();
  });
  it("uses the report's real scenario seed and remains deterministic for the same released inputs", () => {
    setStatisticsSamples(true);
    const first = samples();
    const geometry = screen.getByTestId("statistics-sample-figures").querySelector("polyline")!.getAttribute("points");
    first.unmount();
    const changed = structuredClone(data);
    changed.sampleScenario = "scarce";
    const second = samples(changed);
    expect(screen.getByTestId("statistics-sample-figures").querySelector("polyline")!.getAttribute("points")).not.toBe(
      geometry,
    );
    second.unmount();
    samples();
    expect(screen.getByTestId("statistics-sample-figures").querySelector("polyline")!.getAttribute("points")).toBe(
      geometry,
    );
    expect(current.operational).not.toHaveBeenCalled();
  });
});
