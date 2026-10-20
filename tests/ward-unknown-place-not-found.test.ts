import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import BoardPage from "@/app/ward-flow/board/[unitId]/page";
import CommunityTeamPage from "@/app/ward-flow/community/[teamId]/page";
import EdDepartmentPage from "@/app/ward-flow/ed/[edId]/page";
import StatisticsCommunityPage from "@/app/ward-flow/statistics/community/[teamId]/page";
import WardStatisticsEdPage from "@/app/ward-flow/statistics/ed/[edId]/page";
import StatisticsServicePage from "@/app/ward-flow/statistics/service/[serviceId]/page";
import WardStatisticsUnitPage from "@/app/ward-flow/statistics/ward/[unitId]/page";
import WardAnswerPage from "@/app/ward-flow/ward/[unitId]/answer/page";
import WardUnitPage from "@/app/ward-flow/ward/[unitId]/page";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { isUnknownWardFlowPlace, knownWardUnit } from "@/components/ward-management/ward-known-places";
import { allUnits } from "@/components/ward-management/ward-sites";
import { proxy } from "../src/proxy";

/**
 * DA-32 (overall review, 20 Oct 2026): a link to a ward, department, team or health service that
 * does not exist answered 200, as if the page were fine. Proxy now answers it with a 404 before the
 * page streams, and each page calls `notFound()` as the backstop. People and journeys are records
 * held in the browser or the shared store, so their pages keep the in-page not-found (pinned in
 * `ward-patient-route-recovery.test.ts`).
 */
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404/u;
const STANDARD_WARD = allUnits()[0]!.id;
const TEAM = COMMUNITY_TEAM_PAGES[0]!.id;

describe("which place addresses are unknown", () => {
  it("knows every standard ward and a ward that only a demonstration network has", () => {
    expect(knownWardUnit(STANDARD_WARD)?.id).toBe(STANDARD_WARD);
    expect(allUnits().some((unit) => unit.id === "dn-rph-acute")).toBe(false);
    expect(knownWardUnit("dn-rph-acute")?.id).toBe("dn-rph-acute");
  });

  it.each([
    `/ward-flow/ward/${STANDARD_WARD}`,
    `/ward-flow/ward/${STANDARD_WARD}/answer`,
    `/ward-flow/board/${STANDARD_WARD}`,
    "/ward-flow/ward/dn-rph-acute",
    `/ward-flow/statistics/ward/${STANDARD_WARD}`,
    "/ward-flow/ed/jhc-ed",
    "/ward-flow/ed/JHC",
    "/ward-flow/statistics/ed/jhc-ed",
    `/ward-flow/community/${TEAM}`,
    `/ward-flow/statistics/community/${TEAM}`,
    "/ward-flow/statistics/service/East%20Metro",
    "/ward-flow/people/PT-NOBODY",
    "/ward-flow/movements/WF-NOBODY",
    "/ward-flow",
    "/ward-flow/waiting",
  ])("lets %s through", (path) => {
    expect(isUnknownWardFlowPlace(path)).toBe(false);
  });

  it.each([
    "/ward-flow/ward/no-such-ward",
    "/ward-flow/ward/no-such-ward/answer",
    "/ward-flow/board/no-such-ward",
    "/ward-flow/statistics/ward/no-such-ward",
    "/ward-flow/ed/no-such-ed",
    "/ward-flow/statistics/ed/no-such-ed",
    "/ward-flow/community/no-such-team",
    "/ward-flow/statistics/community/no-such-team",
    "/ward-flow/statistics/service/No%20Such%20Service",
  ])("marks %s unknown", (path) => {
    expect(isUnknownWardFlowPlace(path)).toBe(true);
  });
});

describe("proxy answers an unknown place with a 404", () => {
  it("rewrites an unknown ward to an address no route serves, keeping the CSP", async () => {
    const response = await proxy(new NextRequest(new URL("http://localhost/ward-flow/ward/no-such-ward")));
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost/ward-flow/unknown-place");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("passes a known ward straight through", async () => {
    const response = await proxy(new NextRequest(new URL(`http://localhost/ward-flow/ward/${STANDARD_WARD}`)));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
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
