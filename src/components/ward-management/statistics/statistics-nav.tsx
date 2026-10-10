"use client";

import { usePathname, useRouter } from "next/navigation";

import { HeroTrack, Switch } from "@/components/wf";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import {
  STATISTICS_COMPARE_HREF,
  STATISTICS_EDS_HREF,
  STATISTICS_HOME_HREF,
  STATISTICS_OVERVIEW_HREF,
  STATISTICS_SERVICES_HREF,
  STATISTICS_TEAMS_HREF,
  STATISTICS_WARDS_HREF,
} from "./statistics-sections";
import { WEEKLY_REPORT_HREF } from "@/components/ward-management/reports/report-routes";
import { useStatisticsSamples, setStatisticsSamples } from "./statistics-samples";
import styles from "./statistics-nav.module.css";

export type StatisticsNavSection = "hub" | "overview" | "compare" | "service" | "ward" | "ed" | "community" | "weekly";

interface StatisticsNavProps {
  currentSection?: StatisticsNavSection;
  /**
   * The unit, service or team the page shows. No longer read: since the four index pages
   * (9 Oct 2026) each unit tab opens its index, from a detail page as from anywhere else.
   */
  activeSlug?: string;
  /** Leave the Samples switch out, when the hero places it on its own. */
  withSamples?: boolean;
  /** How many wards the network has, from the page's own state. Left off, Wards shows no count. */
  wardCount?: number;
}

/** Each unit kind's tab is current on its index page and on any one unit's page of that kind. */
function sectionOf(pathname: string): StatisticsNavSection {
  if (pathname.includes("/statistics/overview")) return "overview";
  if (pathname.includes("/statistics/compare")) return "compare";
  if (pathname.includes("/statistics/service")) return "service";
  if (pathname.includes("/statistics/ward")) return "ward";
  if (pathname.includes("/statistics/ed")) return "ed";
  if (pathname.includes("/statistics/community") || pathname.includes("/statistics/teams")) return "community";
  if (pathname.includes("/statistics/weekly")) return "weekly";
  return "hub";
}

/**
 * The router, or null when the nav renders outside the app router (a screen rendered on its own in
 * a test or preview). Links still work there; only the phone select falls back to a plain load.
 */
export function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

/**
 * The current path, or an empty string where no app router is mounted (a page rendered on its own,
 * as unit tests do). A page that names its own section never needs it.
 */
function useOptionalPathname(): string {
  try {
    return usePathname() || "";
  } catch {
    return "";
  }
}

/** The Samples switch. Invented 30-day charts appear at the foot of the page while it is on. */
export function StatisticsSamplesSwitch() {
  const samples = useStatisticsSamples();
  return (
    <span className={styles.samples}>
      <Switch checked={samples} onCheckedChange={setStatisticsSamples} label="Samples" onHero />
    </span>
  );
}

/**
 * The statistics section track. It sits on each page's hero band: Summary, Overview and Compare,
 * then the four unit kinds with their counts. On a phone it becomes one native select.
 */
export function StatisticsNav({ currentSection, withSamples = true, wardCount }: StatisticsNavProps) {
  const pathname = useOptionalPathname();
  const router = useOptionalRouter();

  const activeSection = currentSection || sectionOf(pathname);

  // The four unit kinds open their index pages (Statistics A, 9 Oct 2026): every service, ward, ED
  // and team on one page, each the way into its own page. The tab stays current on a detail page.
  const items = [
    { id: "hub", label: "Summary", href: STATISTICS_HOME_HREF },
    { id: "overview", label: "Overview", href: STATISTICS_OVERVIEW_HREF },
    { id: "compare", label: "Compare", href: STATISTICS_COMPARE_HREF },
    { id: "service", label: "Services", count: HEALTH_SERVICES.length, href: STATISTICS_SERVICES_HREF },
    { id: "ward", label: "Wards", count: wardCount, href: STATISTICS_WARDS_HREF },
    { id: "ed", label: "EDs", count: allEmergencyDepartments().length, href: STATISTICS_EDS_HREF },
    { id: "community", label: "Teams", count: COMMUNITY_TEAM_PAGES.length, href: STATISTICS_TEAMS_HREF },
    { id: "weekly", label: "Weekly", href: WEEKLY_REPORT_HREF },
  ] satisfies Array<{ id: StatisticsNavSection; label: string; href: string; count?: number }>;

  return (
    // The landmark wraps both forms of the section list, so it is there at every width: the track
    // on a desktop and the select on a phone.
    <nav className={styles.navBar} aria-label="Ward Flow statistics sections" data-testid="ward-statistics-nav">
      <label className={styles.mobileSelect}>
        <span>Statistics</span>
        <select
          aria-label="Statistics section"
          value={activeSection}
          onChange={(event) => {
            const item = items.find((entry) => entry.id === event.target.value);
            if (!item) return;
            if (router) router.push(item.href);
            else window.location.assign(item.href);
          }}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <HeroTrack className={styles.track} label="Statistics sections" value={activeSection} items={items} />
      {withSamples ? <StatisticsSamplesSwitch /> : null}
    </nav>
  );
}
