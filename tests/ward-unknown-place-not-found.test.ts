import { describe, expect, it } from "vitest";

import BoardPage from "@/app/ward-flow/board/[unitId]/page";
import CommunityTeamPage from "@/app/ward-flow/community/[teamId]/page";
import EdDepartmentPage from "@/app/ward-flow/ed/[edId]/page";
import StatisticsCommunityPage from "@/app/ward-flow/statistics/community/[teamId]/page";
import WardStatisticsEdPage from "@/app/ward-flow/statistics/ed/[edId]/page";
import StatisticsServicePage from "@/app/ward-flow/statistics/service/[serviceId]/page";
import WardStatisticsUnitPage from "@/app/ward-flow/statistics/ward/[unitId]/page";
import WardAnswerPage from "@/app/ward-flow/ward/[unitId]/answer/page";
import WardUnitPage from "@/app/ward-flow/ward/[unitId]/page";
import { knownWardUnit } from "@/components/ward-management/ward-known-places";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * DA-32 (overall review, 20 Oct 2026): a link to a ward, department, team or health service that
 * does not exist opened as if the page were fine. Each page now calls `notFound()`, so it shows
 * "Page not found" (the host's proxy may not import Ward Flow code, so no proxy check). People and journeys are records
 * held in the browser or the shared store, so their pages keep the in-page not-found (pinned in
 * `ward-patient-route-recovery.test.ts`).
 */
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404/u;
const STANDARD_WARD = allUnits()[0]!.id;

describe("which place addresses are unknown", () => {
  it("knows every standard ward and a ward that only a demonstration network has", () => {
    expect(knownWardUnit(STANDARD_WARD)?.id).toBe(STANDARD_WARD);
    expect(allUnits().some((unit) => unit.id === "dn-rph-acute")).toBe(false);
    expect(knownWardUnit("dn-rph-acute")?.id).toBe("dn-rph-acute");
  });

  it("knows no ward that no scenario has", () => {
    expect(knownWardUnit("no-such-ward")).toBeUndefined();
  });
});

describe("each place page calls notFound() for an unknown id", () => {
  const unknownUnit = { params: Promise.resolve({ unitId: "no-such-ward" }) };
  it.each([
    ["ward", () => WardUnitPage({ ...unknownUnit, searchParams: Promise.resolve({}) })],
    ["ward answer", () => WardAnswerPage(unknownUnit)],
    ["board", () => BoardPage(unknownUnit)],
    ["ward statistics", () => WardStatisticsUnitPage(unknownUnit)],
    ["ED", () => EdDepartmentPage({ params: Promise.resolve({ edId: "no-such-ed" }) })],
    ["ED statistics", () => WardStatisticsEdPage({ params: Promise.resolve({ edId: "no-such-ed" }) })],
    ["community team", () => CommunityTeamPage({ params: Promise.resolve({ teamId: "no-such-team" }) })],
    ["team statistics", () => StatisticsCommunityPage({ params: Promise.resolve({ teamId: "no-such-team" }) })],
    ["service statistics", () => StatisticsServicePage({ params: Promise.resolve({ serviceId: "Nowhere" }) })],
  ] as const)("%s", async (_name, render) => {
    await expect(render()).rejects.toThrow(NOT_FOUND);
  });

  it("still renders a known ward", async () => {
    const page = await WardUnitPage({
      params: Promise.resolve({ unitId: STANDARD_WARD }),
      searchParams: Promise.resolve({}),
    });
    expect(page.props.unitId).toBe(STANDARD_WARD);
  });
});
