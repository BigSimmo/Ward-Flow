import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { forecastBrief } from "@/components/ward-management/forecast/forecast-brief";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { forecastLevers } from "@/components/ward-management/forecast/forecast-levers";
import { ForecastNetworkExtras } from "@/components/ward-management/forecast/forecast-network-extras";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const surface = vi.hoisted(() => ({ model: {} as Record<string, unknown> }));
vi.mock("@/components/ward-management/forecast/use-forecast-model", () => ({
  useForecastModel: () => surface.model,
  useForecastChange: () => null,
}));

const now = NOW_ANCHOR;
const seed = seedWardFlowState();
const original = seed.bedReleases.find((release) =>
  seed.admissions.some((admission) => admission.id === release.admissionId && admission.state === "occupied"),
)!;
const unit = seed.units.find((candidate) => candidate.id === original.unitId)!;
const admission = seed.admissions.find((candidate) => candidate.id === original.admissionId)!;

function fixture(expectedAt: number, blocked: boolean, flagged = true): WardFlowState {
  return {
    ...seed,
    admissions: [
      {
        ...admission,
        patientId: null,
        expectedDischargeAt: expectedAt,
        blockReason: blocked ? ("Awaiting pharmacy" as const) : null,
      },
    ],
    bedReleases: flagged
      ? [
          {
            ...original,
            state: "expected" as const,
            expectedAt,
            blocker: blocked ? ("Awaiting pharmacy" as const) : null,
          },
        ]
      : [],
  };
}

const forecast = (state: ReturnType<typeof fixture>) =>
  forecastByKind([unit], state.bedReleases, state.admissions, [], now, 1);

describe("forecast lever likely uplift", () => {
  it.each([
    ["before today", now - MINUTES_PER_DAY, 0],
    ["today", now, 1],
    ["at the horizon", now + MINUTES_PER_DAY, 1],
  ])("matches the actual blocker-clear effect for a release %s", (_, expectedAt, expectedUplift) => {
    const before = fixture(expectedAt, true);
    const after = wardFlowReducer(before, {
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "ward",
      now,
      releaseId: original.id,
      actingUnitId: unit.id,
    });
    expect(after.rejections).toHaveLength(0);
    const lever = forecastLevers([unit], before.bedReleases, before.admissions, now).find(
      (entry) => entry.kind === "clear_held_up",
    )!;
    expect(lever.beds).toBe(1);
    expect(lever.likelyUplift).toBe(expectedUplift);
    expect(forecast(after).total.likely - forecast(before).total.likely).toBe(expectedUplift);
    expect(
      bedsForecast([unit], after.bedReleases, after.admissions, [], now).horizons[0]!.likely -
        bedsForecast([unit], before.bedReleases, before.admissions, [], now).horizons[0]!.likely,
    ).toBe(expectedUplift);
  });

  it.each([
    ["past date", now - MINUTES_PER_DAY, false, 0],
    ["current date", now, false, 1],
    ["inherited blocker", now, true, 0],
  ])("matches flagging a planned discharge with a %s", (_, expectedAt, blocked, expectedUplift) => {
    const before = fixture(expectedAt, blocked, false);
    const after = wardFlowReducer(before, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now,
      unitId: unit.id,
      actingUnitId: unit.id,
      admissionId: admission.id,
      expectedAt,
      waitingOn: "Nothing outstanding",
    });
    expect(after.rejections).toHaveLength(0);
    const lever = forecastLevers([unit], [], before.admissions, now).find((entry) => entry.kind === "confirm_dates")!;
    expect(lever.beds).toBe(1);
    expect(lever.likelyUplift).toBe(expectedUplift);
    expect(forecast(after).total.likely - forecast(before).total.likely).toBe(expectedUplift);
  });

  it("preserves the full operational count while displaying only the achievable uplift", () => {
    const before = fixture(now - MINUTES_PER_DAY, true);
    before.bedReleases.push({
      ...before.bedReleases[0]!,
      id: "synthetic-current-release",
      admissionId: "synthetic-current-stay",
      expectedAt: now,
    });
    const levers = forecastLevers([unit], before.bedReleases, before.admissions, now);
    const lever = levers.find((entry) => entry.kind === "clear_held_up")!;
    expect(lever.beds).toBe(2);
    expect(lever.likelyUplift).toBe(1);
    surface.model = {
      tomorrow: forecast(before),
      byDays: [],
      levers,
      blockers: { total: 0 },
      notCounted: { leaveBeds: 0, repatriations: 0 },
    };
    const html = renderToStaticMarkup(createElement(ForecastNetworkExtras, { now }));
    expect(html).toContain("Chase 2 held-up releases");
    expect(html).toContain("up to +1");
    expect(html).not.toContain("up to +2");
  });

  it.each([true, false])("uses range-only wording in the action card and brief when blocked=%s", (blocked) => {
    const before = fixture(now - MINUTES_PER_DAY, blocked, blocked);
    const tomorrow = forecast(before);
    const levers = forecastLevers([unit], before.bedReleases, before.admissions, now);
    surface.model = {
      tomorrow,
      byDays: [],
      levers,
      blockers: { total: 0 },
      notCounted: { leaveBeds: 0, repatriations: 0 },
    };
    const html = renderToStaticMarkup(createElement(ForecastNetworkExtras, { now }));
    expect(html).toContain("range only");
    expect(html).not.toContain("up to +");
    const brief = forecastBrief(
      tomorrow,
      levers,
      { targetMinutes: 24 * 60, horizonMinutes: 24 * 60, atRisk: [], alreadyOver: 0, byEd: [] },
      () => "ED",
    );
    expect(brief.find((line) => line.label === "Best single action")!.text).toContain("range only");
    expect(brief.find((line) => line.label === "Best single action")!.text).not.toContain("Up to 1");
  });

  it("keeps a pulled stay in the operational count without promising an unavailable flag action", () => {
    const before = fixture(now, false, false);
    before.admissions[0] = { ...before.admissions[0]!, state: "pulled" };
    const after = wardFlowReducer(before, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now,
      unitId: unit.id,
      actingUnitId: unit.id,
      admissionId: admission.id,
      expectedAt: now,
      waitingOn: "Nothing outstanding",
    });
    expect(after.rejections).toHaveLength(before.rejections.length + 1);
    expect(after.rejections.at(-1)!.reason).toContain("is pulled");
    expect(after.bedReleases).toEqual(before.bedReleases);
    expect(forecast(after)).toEqual(forecast(before));
    const tomorrow = forecast(before);
    const levers = forecastLevers([unit], [], before.admissions, now);
    expect(levers.find((entry) => entry.kind === "confirm_dates")).toMatchObject({ beds: 1, likelyUplift: 0 });
    surface.model = {
      tomorrow,
      byDays: [],
      levers,
      blockers: { total: 0 },
      notCounted: { leaveBeds: 0, repatriations: 0 },
    };
    const html = renderToStaticMarkup(createElement(ForecastNetworkExtras, { now }));
    expect(html).toContain("range only");
    expect(html).toContain("Reserved stays must arrive");
    expect(html).not.toContain("up to +");
    const brief = forecastBrief(
      tomorrow,
      levers,
      { targetMinutes: 24 * 60, horizonMinutes: 24 * 60, atRisk: [], alreadyOver: 0, byEd: [] },
      () => "ED",
    );
    expect(brief.find((line) => line.label === "Best single action")!.text).toContain("range only");
    expect(brief.find((line) => line.label === "Best single action")!.text).not.toContain("Up to 1");
  });

  it("ranks an action that can lift likely ahead of a larger group needing new dates", () => {
    const before = fixture(now - MINUTES_PER_DAY, true);
    before.bedReleases.push({
      ...before.bedReleases[0]!,
      id: "synthetic-old-release",
      admissionId: "synthetic-old-stay",
    });
    before.admissions.push({
      ...admission,
      id: "synthetic-current-stay",
      patientId: null,
      expectedDischargeAt: now,
      blockReason: null,
    });
    const levers = forecastLevers([unit], before.bedReleases, before.admissions, now);
    expect(levers[0]).toMatchObject({ kind: "confirm_dates", beds: 1, likelyUplift: 1 });
    expect(levers[1]).toMatchObject({ kind: "clear_held_up", beds: 2, likelyUplift: 0 });
  });
});
