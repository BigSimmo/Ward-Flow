"use client";

import modes from "@/components/ward-management/ward-management-modes.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import stats from "@/components/ward-management/statistics/proposal/statistics-proposal.module.css";

import { CapacityPolished } from "./polished/capacity-polished";
import { NetworkPolished } from "./polished/network-polished";

/**
 * Preview-only frame (third pass, 5 October 2026): the current Capacity and Network screens with
 * their structure unchanged, polished in place. The banner names the preview and links back to
 * the current screen. The Network shell mirrors `WardModeWorkspace` for the flow role.
 */
export function BedFlowProposalPreview({ screen }: { screen: "capacity" | "network" }) {
  const current = screen === "capacity" ? "/mockups/ward-flow/capacity" : "/mockups/ward-flow/network";
  return (
    <>
      <div className={stats.previewBar} data-testid="bed-flow-proposal-preview-bar">
        <strong>Polished {screen === "capacity" ? "Capacity" : "Network"} (preview)</strong>
        <nav className={stats.previewTabs} aria-label="Polished bed flow screens">
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
      {screen === "capacity" ? (
        <CapacityPolished />
      ) : (
        <div
          className={`${modes.modeShell} ${modes.thirdEditionModeShell}`}
          data-testid="ward-mode-network-polished"
          data-role="flow"
          data-ward-design="third-edition"
        >
          <main id="main-content" className={modes.modeContent}>
            <h1 className="sr-only">Network</h1>
            <section className={modes.roleFocus} aria-live="polite">
              <strong>Statewide coordination focus</strong>
              <span>Review matches, cross-catchment escalation, pulls and owned exceptions.</span>
            </section>
            <NetworkPolished />
            <WardPrototypeFooter
              testId="ward-network-polished-governance"
              note="Synthetic network figures and bed statuses · Not a medical device"
            />
          </main>
        </div>
      )}
    </>
  );
}
