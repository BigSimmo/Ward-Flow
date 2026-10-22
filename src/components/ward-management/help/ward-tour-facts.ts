"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { durMinutes } from "@/components/wf";
import { communityTeamById, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { isOfficerJob } from "@/components/ward-management/officer/officer-jobs";
import { usePersonaDeskId } from "@/components/ward-management/settings/persona-sync";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { edHref, teamHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { wardPlaceIdFor } from "@/components/ward-management/ward-place";
import { homeHrefFor } from "@/components/ward-management/ward-role-access";
import { edById, edShortName, siteByCode } from "@/components/ward-management/ward-sites";

import type { TourFacts, TourRole } from "./ward-tour-steps";

const COMMUNITY_ROUTE = /\/ward-flow\/community\/([^/?#]+)/;
const FIXED_HOMES: Partial<Record<TourRole, string>> = {
  coordinator: "/ward-flow",
  officer: "/ward-flow/transport/officer",
  bed_manager: "/ward-flow/capacity",
  executive: "/ward-flow/statistics",
  // The access admin's home is Settings, but the review screen is what the tour walks through.
  admin: "/ward-flow/governance",
};

/**
 * The signed-in desk's place and the figures its home screen shows, for the tour's words, and the
 * address of that home, where the tour runs. The place is the desk's own (role access), else the
 * desk last chosen in "Go to a desk", else the page in view when it is that kind of desk's page.
 */
export function useTourFacts(role: TourRole): { facts: TourFacts; home: string | undefined } {
  const pathname = usePathname() ?? "";
  const access = useEffectiveWardAccess();
  const deskId = usePersonaDeskId();
  const { counts } = useWardNavCounts();
  const { movements, units, bedReleases, admissions, leaveBeds, configuration } = useWardFlowSelect(
    "movements",
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "configuration",
  );
  const now = useWardFlowClock();
  const network = useWardNetwork();

  return useMemo(() => {
    const scope = access.role === role ? access.scope : undefined;
    const routePlace = wardPlaceIdFor(pathname);
    const facts: {
      -readonly [K in keyof TourFacts]: TourFacts[K];
    } = {
      readyBeds: counts.capacity?.value,
      openMovements: counts.movements?.value,
      referralsWaiting: counts.referrals?.value,
      waitingInEd: counts.delays?.value,
    };
    let home = FIXED_HOMES[role];

    if (role === "coordinator") {
      const top = edOpenSummaries(movements, now)
        .filter((summary) => summary.waiting > 0)
        .toSorted((a, b) => b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting)[0];
      if (top)
        facts.topEd = { name: edShortName(top.ed), waiting: top.waiting, longest: durMinutes(top.longestWaitMinutes) };
    }

    if (role === "ward") {
      const unitId = scope?.kind === "ward" ? scope.unitIds[0] : (routePlace ?? deskId);
      const unit = unitId ? units.find((candidate) => candidate.id === unitId) : undefined;
      if (unit) {
        const site = siteByCode(unit.siteCode);
        facts.placeName = unit.name;
        facts.place = site ? `${unit.name} at ${site.name}` : unit.name;
        const entry = hubEntries({ units, sites: network.sites, bedReleases, admissions, leaveBeds, now }).find(
          (candidate) => candidate.id === unit.id,
        );
        if (entry?.beds !== undefined) {
          facts.ward = {
            beds: entry.beds,
            occupied: entry.occupied ?? 0,
            ready: entry.ready ?? 0,
            confirmedAt: entry.confirmedAt === undefined ? undefined : formatInstant(entry.confirmedAt),
          };
        }
        home = unitHref(unit.id);
      }
    }

    if (role === "ed") {
      const edId = scope?.kind === "ed" ? scope.edId : (routePlace ?? deskId);
      const ed = edId ? edById(edId) : undefined;
      if (ed) {
        const site = siteByCode(ed.siteCode);
        facts.placeName = edShortName(ed);
        facts.place = site ? `${site.name} Emergency Department` : ed.name;
        const summary = edOpenSummaries(movements, now).find((candidate) => candidate.ed.id === ed.id);
        facts.ed = {
          waiting: summary?.waiting ?? 0,
          longest: summary && summary.waiting > 0 ? durMinutes(summary.longestWaitMinutes) : undefined,
          targetHours: Math.round(configuration.edAccessTargetMinutes / 60),
        };
        home = edHref(ed.id);
      }
    }

    if (role === "community") {
      const slug =
        scope?.kind === "team" ? communityTeamSlug(scope.teamName) : (COMMUNITY_ROUTE.exec(pathname)?.[1] ?? deskId);
      const team = slug ? communityTeamById(slug) : null;
      if (team) {
        facts.placeName = team.name;
        facts.place = `the ${team.name} team`;
        home = teamHref(team.id);
      }
    }

    if (role === "bed_manager" && scope?.kind === "site") {
      const site = siteByCode(scope.siteCode);
      if (site) {
        facts.placeName = site.name;
        facts.place = site.name;
      }
    }

    if (role === "officer") facts.activeJobs = movements.filter(isOfficerJob).length;

    // A signed-in desk's own home, as the access table names it, wins over a guess from the page.
    if (access.role === role && role !== "admin" && role !== "coordinator") {
      home = homeHrefFor(access, communityTeamSlug);
    }
    return { facts, home };
  }, [
    role,
    access,
    pathname,
    deskId,
    counts,
    movements,
    units,
    bedReleases,
    admissions,
    leaveBeds,
    configuration,
    now,
    network,
  ]);
}
