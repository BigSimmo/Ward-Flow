"use client";

// Network's Browse card (simplification mock-up, 26 Nov 2026, batch 2 plan A). The four index
// pages fold into Network as segments of one card: Wards (the pressure table and the Wards index's
// two charts), EDs, Services and Teams (each index's own body). One segment is mounted at a time.
// The old index addresses still open: they show Network on their segment.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

import { Card, CardBody, CardHead, Segmented, Spinner, cx } from "@/components/wf";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { useCanOpenHref } from "../shell/ward-access";
import { BrowseEmbed, LeadsBrowse, SHOW_WARDS_EVENT } from "./statistics-browse-slot";
import { STATISTICS_EDS_HREF, STATISTICS_SERVICES_HREF, STATISTICS_TEAMS_HREF } from "./statistics-sections";
import browseStyles from "./statistics-browse.module.css";
import styles from "./statistics-v6.module.css";

export type BrowseSegment = "wards" | "eds" | "services" | "teams";

/**
 * The segment an old index address names, or null on Network's own address (Wards, no scroll).
 * Opened from an old address, the page scrolls to the Browse card.
 */
export const BrowseInitial = createContext<BrowseSegment | null>(null);

function BrowseLoading({ label }: { label: string }) {
  return (
    <Card>
      <CardHead title="Browse" meta={label} />
      <CardBody className={styles.viewLoading}>
        <Spinner />
        <p role="status">Loading {label.toLowerCase()}…</p>
      </CardBody>
    </Card>
  );
}

const WardsCharts = dynamic(
  withLoadRetry(() => import("./statistics-wards-index").then((m) => m.StatisticsWardsIndexScreen)),
  { ssr: false, loading: () => null },
);
const EdsBody = dynamic(
  withLoadRetry(() => import("./statistics-eds-index").then((m) => m.StatisticsEdsIndexScreen)),
  { ssr: false, loading: () => <BrowseLoading label="Emergency departments" /> },
);
const ServicesBody = dynamic(
  withLoadRetry(() => import("./statistics-services-index").then((m) => m.StatisticsServicesIndexScreen)),
  { ssr: false, loading: () => <BrowseLoading label="Health services" /> },
);
const TeamsBody = dynamic(
  withLoadRetry(() => import("./statistics-teams-index").then((m) => m.StatisticsTeamsIndexScreen)),
  { ssr: false, loading: () => <BrowseLoading label="Community teams" /> },
);

/**
 * The Browse card and the cards of its chosen segment. `wardsLead` is Network's own pressure table,
 * which leads the Wards segment; `wardCount` is its row count.
 */
export function StatisticsBrowse({ wardsLead, wardCount }: { wardsLead: ReactNode; wardCount: number }) {
  const named = useContext(BrowseInitial);
  const initial = named ?? "wards";
  useEffect(() => {
    if (!named) return;
    // After the router's own scroll to the top and the occupancy card above have settled.
    const timer = window.setTimeout(() => document.getElementById("browse")?.scrollIntoView?.({ block: "start" }), 400);
    return () => window.clearTimeout(timer);
  }, [named]);
  const canOpen = useCanOpenHref();
  const items = (
    [
      { id: "wards", label: "Wards", count: wardCount, open: true },
      { id: "eds", label: "EDs", count: allEmergencyDepartments().length, open: canOpen(STATISTICS_EDS_HREF) },
      { id: "services", label: "Services", count: HEALTH_SERVICES.length, open: canOpen(STATISTICS_SERVICES_HREF) },
      { id: "teams", label: "Teams", count: COMMUNITY_TEAM_PAGES.length, open: canOpen(STATISTICS_TEAMS_HREF) },
    ] satisfies Array<{ id: BrowseSegment; label: string; count: number; open: boolean }>
  ).filter((item) => item.open);
  const [chosen, setChosen] = useState<BrowseSegment>(initial);
  // Audit three #6: the hero's "Show wards" lands on the Wards segment, its chip already on.
  useEffect(() => {
    const show = () => setChosen("wards");
    window.addEventListener(SHOW_WARDS_EVENT, show);
    return () => window.removeEventListener(SHOW_WARDS_EVENT, show);
  }, []);
  const segment = items.some((item) => item.id === chosen) ? chosen : "wards";

  const switcher =
    items.length < 2 ? null : (
      <span className={browseStyles.switchScroll}>
        <Segmented<BrowseSegment>
          className={browseStyles.switch}
          label="Browse"
          value={segment}
          onChange={setChosen}
          items={items.map(({ id, label, count }) => ({ id, label, count }))}
        />
      </span>
    );

  return (
    <div
      id="browse"
      className={cx(styles.stack, browseStyles.root)}
      data-testid="ward-statistics-browse"
      data-segment={segment}
    >
      <BrowseEmbed switcher={switcher}>
        {segment === "wards" ? (
          <>
            <LeadsBrowse>{wardsLead}</LeadsBrowse>
            <WardsCharts />
          </>
        ) : segment === "eds" ? (
          <EdsBody />
        ) : segment === "services" ? (
          <ServicesBody />
        ) : (
          <TeamsBody />
        )}
      </BrowseEmbed>
    </div>
  );
}
