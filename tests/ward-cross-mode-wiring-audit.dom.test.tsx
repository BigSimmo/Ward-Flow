import { act, render, screen } from "@testing-library/react";
import { memo, useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { groupDischarges } from "@/components/ward-management/discharges/discharge-board-model";
import { useStatisticsLive } from "@/components/ward-management/statistics/statistics-hero";
import { WardFlowProvider, useWardFlow, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

let current: ReturnType<typeof useWardFlow>;
function Controller() {
  const value = useWardFlow();
  useLayoutEffect(() => {
    current = value;
  });
  return null;
}

const BedView = memo(function BedView() {
  const { units, admissions, bedReleases, leaveBeds, now } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "leaveBeds",
    "now",
  );
  return (
    <output data-testid="beds-ready">
      {networkWardRows(units, now, bedReleases, admissions, leaveBeds).reduce((sum, row) => sum + row.ready, 0)}
    </output>
  );
});

const ForecastView = memo(function ForecastView() {
  const { units, admissions, bedReleases, movements, plannedAdmissions, now } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "movements",
    "plannedAdmissions",
    "now",
  );
  const forecast = bedsForecast(units, bedReleases, admissions, movements, now, plannedAdmissions).horizons[0];
  return <output data-testid="forecast">{JSON.stringify(forecast)}</output>;
});

const StatisticsView = memo(function StatisticsView() {
  const live = useStatisticsLive();
  const { units, admissions, bedReleases, leaveBeds } = live.state;
  const ready = networkWardRows(units, live.now, bedReleases, admissions, leaveBeds).reduce(
    (sum, row) => sum + row.ready,
    0,
  );
  return (
    <>
      <output data-testid="statistics-ready">{ready}</output>
      <button onClick={live.togglePause}>Toggle statistics pause</button>
    </>
  );
});

const DischargeView = memo(function DischargeView() {
  const { bedReleases, now } = useWardFlowSelect("bedReleases", "now");
  const groups = groupDischarges(bedReleases, now);
  return (
    <output data-testid="discharge-counts">
      {JSON.stringify({
        blocked: groups.blocked.length,
        confirmed: groups.confirmed.length,
        expected: groups.expected.length,
      })}
    </output>
  );
});

function mount() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Controller />
      <BedView />
      <ForecastView />
      <StatisticsView />
      <DischargeView />
    </WardFlowProvider>,
  );
}

describe("real provider updates all subscribed modes", () => {
  it("propagates repeated capacity changes and catches Statistics up after an intentional pause", () => {
    mount();
    const unitId = "fre-adult-open";
    const confirm = (value: number) => {
      const unit = current.units.find((candidate) => candidate.id === unitId)!;
      const refusals = current.rejections.length;
      act(() => {
        current.dispatch({
          type: "CONFIRM_CAPACITY",
          role: "ward",
          now: current.now,
          unitId,
          actingUnitId: unitId,
          expectedRevision: unit.allocatable.revision ?? 0,
          value,
        });
      });
      expect(current.rejections.length).toBe(refusals);
    };
    for (const value of [0, 1, 0, 2, 1]) {
      confirm(value);
      const ready = Number(screen.getByTestId("beds-ready").textContent);
      expect(JSON.parse(screen.getByTestId("forecast").textContent!).readyNow).toBe(ready);
      expect(Number(screen.getByTestId("statistics-ready").textContent)).toBe(ready);
    }
    act(() => {
      screen.getByRole("button", { name: "Toggle statistics pause" }).click();
    });
    const paused = screen.getByTestId("statistics-ready").textContent;
    confirm(0);
    expect(screen.getByTestId("statistics-ready").textContent).toBe(paused);
    expect(screen.getByTestId("beds-ready").textContent).not.toBe(paused);
    act(() => {
      screen.getByRole("button", { name: "Toggle statistics pause" }).click();
    });
    expect(screen.getByTestId("statistics-ready").textContent).toBe(screen.getByTestId("beds-ready").textContent);
  });

  it("propagates a release blocker and its removal into discharge and forecast consumers", () => {
    mount();
    const release = current.bedReleases.find(
      (candidate) =>
        candidate.state !== "discharged" &&
        candidate.blocker === null &&
        candidate.expectedAt >= current.now &&
        candidate.expectedAt < current.now + 1440,
    )!;
    expect(release).toBeDefined();
    const original = JSON.parse(screen.getByTestId("discharge-counts").textContent!);
    const before = JSON.parse(screen.getByTestId("forecast").textContent!);
    const refusals = current.rejections.length;
    act(() => {
      current.dispatch({
        type: "BLOCK_BED_RELEASE",
        role: "ward",
        now: current.now,
        releaseId: release.id,
        actingUnitId: release.unitId,
        blocker: "Awaiting pharmacy",
      });
    });
    expect(current.rejections.length).toBe(refusals);
    expect(JSON.parse(screen.getByTestId("discharge-counts").textContent!).blocked).toBe(original.blocked + 1);
    expect(JSON.parse(screen.getByTestId("forecast").textContent!).heldUp).toBe(before.heldUp + 1);
    act(() => {
      current.dispatch({
        type: "CLEAR_BED_RELEASE_BLOCK",
        role: "ward",
        now: current.now,
        releaseId: release.id,
        actingUnitId: release.unitId,
      });
    });
    expect(current.rejections.length).toBe(refusals);
    expect(JSON.parse(screen.getByTestId("discharge-counts").textContent!)).toEqual(original);
    expect(JSON.parse(screen.getByTestId("forecast").textContent!)).toEqual(before);
  });
});
