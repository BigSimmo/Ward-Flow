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
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";
import { useWardShellPublic } from "../shell/ward-shell-public-context";
import { useServiceScope } from "../shell/ward-service-store";
import { scenarioWardNetwork } from "../ward-scenarios";
import { dueSoonThresholdsOf } from "../ward-clock";
import { wardPlaceIdFor } from "@/components/ward-management/ward-place";
import { edById, edShortName, siteByCode } from "@/components/ward-management/ward-sites";

import type { TourFacts, TourRole } from "./ward-tour-steps";
import { resolveTourHome } from "./ward-tour-home";

const COMMUNITY_ROUTE = /\/ward-flow\/community\/([^/?#]+)/;

/**
 * The signed-in desk's place and the figures its home screen shows, for the tour's words, and the
 * address of that home, where the tour runs. The place is the desk's own (role access), else the
 * desk last chosen in "Go to a desk", else the page in view when it is that kind of desk's page.
 */
export function useTourFacts(role: TourRole): {
  facts: TourFacts;
  home: string | undefined;
  deskHome: string | undefined;
} {
  const pathname = usePathname() ?? "";
  const access = useEffectiveWardAccess();
  const deskId = usePersonaDeskId();
  const flow = useOptionalWardFlowSelect(
    "movements",
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "configuration",
    "referrals",
    "scenario",
    "now",
  );
  const report = useExecutiveStatistics();
  const reporting = useExecutiveStatisticsControl();
  const shell = useWardShellPublic();
  const service = useServiceScope();

  return useMemo(() => {
    const homes = resolveTourHome({
      role,
      access,
      pathname,
      deskId,
      units: flow?.units,
      executive: reporting.executive,
    });
    if (reporting.executive) {
      const exact = (value: { kind: string; value?: number } | undefined) =>
        value?.kind === "exact" ? value.value : undefined;
      return {
        facts: {
          place: shell?.placeLabel,
          readyBeds: report?.capacity.ready,
          openMovements: exact(report?.network.people.stillOpen),
          openEdJourneys: exact(report?.network.people.waitingInEd),
        },
        ...homes,
      };
    }
    if (!flow) return { facts: {}, ...homes };
    const { movements, units, bedReleases, admissions, leaveBeds, configuration, now, referrals, scenario } = flow;
    const network = scenarioWardNetwork(scenario);
    const counts = wardNavCounts({
      movements,
      units,
      bedReleases,
      admissions,
      leaveBeds,
      referrals,
      now,
      sites: network.sites,
      thresholds: dueSoonThresholdsOf(configuration),
      service,
    });
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

    if (role === "coordinator") {
      const top = edOpenSummaries(movements, now)
        .filter((summary) => summary.waiting > 0)
        .toSorted((a, b) => b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting)[0];
      if (top)
        facts.topEd = {
          name: edShortName(top.ed),
          waiting: top.waiting,
          longest: durMinutes(top.longestWaitMinutes),
        };
    }

    if (role === "ward") {
      const unitId = scope?.kind === "ward" ? scope.unitIds[0] : (routePlace ?? deskId);
      const unit = unitId ? units.find((candidate) => candidate.id === unitId) : undefined;
      if (unit) {
        const site = siteByCode(unit.siteCode);
        facts.placeName = unit.name;
        facts.place = site ? `${unit.name} at ${site.name}` : unit.name;
        const entry = hubEntries({
          units,
          sites: network.sites,
          bedReleases,
          admissions,
          leaveBeds,
          now,
        }).find((candidate) => candidate.id === unit.id);
        if (entry?.beds !== undefined) {
          facts.ward = {
            beds: entry.beds,
            occupied: entry.occupied ?? 0,
            ready: entry.ready ?? 0,
            confirmedAt: entry.confirmedAt === undefined ? undefined : formatInstantWithDay(entry.confirmedAt, now),
          };
        }
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
      }
    }

    if (role === "community") {
      const slug =
        scope?.kind === "team" ? communityTeamSlug(scope.teamName) : (COMMUNITY_ROUTE.exec(pathname)?.[1] ?? deskId);
      const team = slug ? communityTeamById(slug) : null;
      if (team) {
        facts.placeName = team.name;
        facts.place = `the ${team.name} team`;
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

    return { facts, ...homes };
  }, [role, access, pathname, deskId, flow, report, reporting.executive, shell, service]);
}
