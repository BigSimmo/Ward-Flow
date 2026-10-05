"use client";

import { CommunityStatisticsProposal } from "./community-statistics-proposal";
import { CompareStatisticsProposal } from "./compare-statistics-proposal";
import { EdStatisticsProposal } from "./ed-statistics-proposal";
import { FlowStatisticsProposal } from "./flow-statistics-proposal";
import { NetworkStatisticsProposal } from "./network-statistics-proposal";
import { ServiceStatisticsProposal } from "./service-statistics-proposal";
import { StatewideStatisticsProposal } from "./statewide-statistics-proposal";
import { proposalHref, type ProposalScreen } from "./statistics-proposal-parts";
import { WardStatisticsProposal } from "./ward-statistics-proposal";
import { StatisticsCommunityScreen } from "./polished/statistics-community-screen";
import { StatisticsCompareScreen } from "./polished/statistics-compare-screen";
import { StatisticsEdScreen } from "./polished/statistics-ed-screen";
import { StatisticsOverviewScreen } from "./polished/statistics-overview-screen";
import { StatisticsScreen } from "./polished/statistics-screen";
import { StatisticsServiceScreen } from "./polished/statistics-service-screen";
import { StatisticsWardScreen } from "./polished/statistics-ward-screen";
import polish from "./polished/statistics-polish.module.css";
import styles from "./statistics-proposal.module.css";

/**
 * The polished screens: the current statistics pages with their structure kept exactly (same
 * sections, tabs, order and layout), polished in place. Josh, 5 October 2026: "You are simply
 * polishing and elevating everything that is already there."
 */
const POLISHED: { id: string; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "overview", label: "Network overview" },
  { id: "compare", label: "Compare" },
  { id: "service", label: "Health service" },
  { id: "ward", label: "Ward" },
  { id: "ed", label: "Emergency department" },
  { id: "community", label: "Community team" },
];

function polishedHref(id: string, key?: string): string {
  const query = new URLSearchParams({ screen: id });
  if (key) query.set("id", key);
  return `/mockups/ward-flow/statistics/proposal?${query.toString()}`;
}

const SCREENS: { id: ProposalScreen; label: string }[] = [
  { id: "statewide", label: "Statewide" },
  { id: "network", label: "Network overview" },
  { id: "service", label: "Health service" },
  { id: "ward", label: "Ward" },
  { id: "ed", label: "Emergency department" },
  { id: "community", label: "Community team" },
  { id: "flow", label: "Referrals and discharges" },
  { id: "compare", label: "Compare" },
];

/**
 * Preview-only frame. The polished screens are the mockup; the earlier restructured screens stay
 * reachable as "Proposed" ideas only (`screen=proposed-…`) and are not the recommendation.
 */
export function StatisticsProposalPreview({ screen, id }: { screen?: string; id?: string }) {
  const proposed = screen?.startsWith("proposed-") ? screen.slice("proposed-".length) : null;
  const active = proposed
    ? (SCREENS.find((entry) => entry.id === proposed)?.id ?? "statewide")
    : (POLISHED.find((entry) => entry.id === screen)?.id ?? "summary");
  return (
    <>
      <div className={styles.previewBar} data-testid="statistics-proposal-preview-bar">
        <strong>{proposed ? "Proposed structural ideas (not the mockup)" : "Polished statistics (mockup)"}</strong>
        <nav className={styles.previewTabs} aria-label="Polished statistics screens">
          {POLISHED.map((entry) => (
            <a
              key={entry.id}
              href={polishedHref(entry.id)}
              aria-current={!proposed && entry.id === active ? "page" : undefined}
            >
              {entry.label}
            </a>
          ))}
        </nav>
        <a className={styles.link} href={proposalHref("statewide")}>
          Proposed structural ideas ›
        </a>
        <a className={styles.link} href="/mockups/ward-flow/statistics">
          Current statistics ›
        </a>
      </div>
      {proposed ? (
        <>
          {active === "statewide" ? <StatewideStatisticsProposal /> : null}
          {active === "service" ? <ServiceStatisticsProposal serviceId={id} /> : null}
          {active === "ward" ? <WardStatisticsProposal unitId={id} /> : null}
          {active === "ed" ? <EdStatisticsProposal edId={id} /> : null}
          {active === "community" ? <CommunityStatisticsProposal teamId={id} /> : null}
          {active === "compare" ? <CompareStatisticsProposal /> : null}
          {active === "network" ? <NetworkStatisticsProposal /> : null}
          {active === "flow" ? <FlowStatisticsProposal /> : null}
        </>
      ) : (
        <div className={polish.root} data-testid="statistics-polished">
          {active === "summary" ? <StatisticsScreen /> : null}
          {active === "overview" ? <StatisticsOverviewScreen /> : null}
          {active === "compare" ? <StatisticsCompareScreen /> : null}
          {active === "service" ? <StatisticsServiceScreen serviceId={id ?? "North Metro"} /> : null}
          {active === "ward" ? <StatisticsWardScreen unitId={id ?? "rph-adult-secure"} /> : null}
          {active === "ed" ? <StatisticsEdScreen edId={id ?? "rph-ed"} /> : null}
          {active === "community" ? <StatisticsCommunityScreen teamId={id ?? "albany"} /> : null}
        </div>
      )}
    </>
  );
}
