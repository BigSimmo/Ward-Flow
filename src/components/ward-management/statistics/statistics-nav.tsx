"use client";

import { usePathname, useRouter } from "next/navigation";

import { HeroTrack, Switch } from "@/components/wf";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import {
  STATISTICS_COMPARE_HREF,
  STATISTICS_UNIT_CHOOSER_HREF,
  STATISTICS_SERVICE_CHOOSER_HREF,
  STATISTICS_COMMUNITY_CHOOSER_HREF,
} from "./statistics-sections";
import { WEEKLY_REPORT_HREF } from "@/components/ward-management/reports/report-routes";
import { useStatisticsSamples, setStatisticsSamples } from "./statistics-samples";
import styles from "./statistics-nav.module.css";

export type StatisticsNavSection = "hub" | "overview" | "compare" | "service" | "ward" | "ed" | "community" | "weekly";

interface StatisticsNavProps {
  currentSection?: StatisticsNavSection;
  activeSlug?: string;
  /** Leave the Samples switch out, when the hero places it on its own. */
  withSamples?: boolean;
  /** How many wards the network has, from the page's own state. Left off, Wards shows no count. */
  wardCount?: number;
}

function sectionOf(pathname: string): StatisticsNavSection {
  if (pathname.includes("/statistics/overview")) return "overview";
  if (pathname.includes("/statistics/compare")) return "compare";
  if (pathname.includes("/statistics/service")) return "service";
  if (pathname.includes("/statistics/ward")) return "ward";
  if (pathname.includes("/statistics/ed")) return "ed";
  if (pathname.includes("/statistics/community")) return "community";
  if (pathname.includes("/statistics/weekly")) return "weekly";
  return "hub";
}

function slugOf(pathname: string): string | undefined {
  for (const part of ["service", "ward", "ed", "community"]) {
    const marker = `/statistics/${part}/`;
    if (pathname.includes(marker)) return pathname.split(marker)[1]?.split("/")[0]?.split("?")[0];
  }
  return undefined;
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
export function StatisticsNav({ currentSection, activeSlug, withSamples = true, wardCount }: StatisticsNavProps) {
  const pathname = useOptionalPathname();
  const router = useOptionalRouter();

  const activeSection = currentSection || sectionOf(pathname);
  const slug = activeSlug ?? slugOf(pathname);
  const detail = (section: StatisticsNavSection, base: string, fallback: string) =>
    activeSection === section && slug ? `/mockups/ward-flow/statistics/${base}/${slug}` : fallback;

  const items = [
    { id: "hub", label: "Summary", href: "/mockups/ward-flow/statistics" },
    { id: "overview", label: "Overview", href: "/mockups/ward-flow/statistics/overview" },
    { id: "compare", label: "Compare", href: "/mockups/ward-flow/statistics/compare" },
    {
      id: "service",
      label: "Services",
      count: HEALTH_SERVICES.length,
      href: detail("service", "service", STATISTICS_SERVICE_CHOOSER_HREF),
    },
    {
      id: "ward",
      label: "Wards",
      count: wardCount,
      href: detail("ward", "ward", STATISTICS_UNIT_CHOOSER_HREF),
    },
    {
      id: "ed",
      label: "EDs",
      count: allEmergencyDepartments().length,
      href: detail("ed", "ed", STATISTICS_COMPARE_HREF),
    },
    {
      id: "community",
      label: "Teams",
      count: COMMUNITY_TEAM_PAGES.length,
      href: detail("community", "community", STATISTICS_COMMUNITY_CHOOSER_HREF),
    },
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
            // A chooser on this same page is reached by its fragment alone. Setting the hash fires
            // `hashchange`, which opens the chooser's tab; a router push of the same path would not.
            const target = new URL(item.href, window.location.href);
            if (target.pathname === window.location.pathname && target.hash) {
              window.location.hash = target.hash;
              return;
            }
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
