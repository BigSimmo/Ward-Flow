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
import styles from "./statistics-proposal.module.css";

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

/** Preview-only frame: a banner and screen switcher around the proposed statistics screens. */
export function StatisticsProposalPreview({ screen, id }: { screen?: string; id?: string }) {
  const active = SCREENS.find((entry) => entry.id === screen)?.id ?? "statewide";
  return (
    <>
      <div className={styles.previewBar} data-testid="statistics-proposal-preview-bar">
        <strong>Proposed statistics redesign (preview)</strong>
        <nav className={styles.previewTabs} aria-label="Proposed statistics screens">
          {SCREENS.map((entry) => (
            <a key={entry.id} href={proposalHref(entry.id)} aria-current={entry.id === active ? "page" : undefined}>
              {entry.label}
            </a>
          ))}
        </nav>
        <a className={styles.link} href="/mockups/ward-flow/statistics">
          Current statistics ›
        </a>
      </div>
      {active === "statewide" ? <StatewideStatisticsProposal /> : null}
      {active === "service" ? <ServiceStatisticsProposal serviceId={id} /> : null}
      {active === "ward" ? <WardStatisticsProposal unitId={id} /> : null}
      {active === "ed" ? <EdStatisticsProposal edId={id} /> : null}
      {active === "community" ? <CommunityStatisticsProposal teamId={id} /> : null}
      {active === "compare" ? <CompareStatisticsProposal /> : null}
      {active === "network" ? <NetworkStatisticsProposal /> : null}
      {active === "flow" ? <FlowStatisticsProposal /> : null}
    </>
  );
}
