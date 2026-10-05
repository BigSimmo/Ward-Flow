"use client";

import stats from "@/components/ward-management/statistics/proposal/statistics-proposal.module.css";

import { CapacityProposal } from "./capacity-proposal";
import { NetworkProposal } from "./network-proposal";

/** Preview-only frame: a banner naming the proposal and linking to the current screen. */
export function BedFlowProposalPreview({ screen, view }: { screen: "capacity" | "network"; view?: string }) {
  const current = screen === "capacity" ? "/mockups/ward-flow/capacity" : "/mockups/ward-flow/network";
  return (
    <>
      <div className={stats.previewBar} data-testid="bed-flow-proposal-preview-bar">
        <strong>Proposed {screen === "capacity" ? "Capacity" : "Network"} redesign (preview)</strong>
        <nav className={stats.previewTabs} aria-label="Proposed bed flow screens">
          <a href="/mockups/ward-flow/capacity/proposal" aria-current={screen === "capacity" ? "page" : undefined}>
            Capacity
          </a>
          <a href="/mockups/ward-flow/network/proposal" aria-current={screen === "network" ? "page" : undefined}>
            Network
          </a>
        </nav>
        <a className={stats.link} href={current}>
          Current screen ›
        </a>
      </div>
      {screen === "capacity" ? <CapacityProposal /> : <NetworkProposal initialView={view} />}
    </>
  );
}
