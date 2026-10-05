"use client";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { TransportHubProposal } from "@/components/ward-management/officer/proposal/transport-hub-proposal";

import polish from "./movement-polish.module.css";
import { MovementRecordProposal } from "./movement-record-proposal";
import { MovementsBoardProposal } from "./movements-board-proposal";
import { ProposalPreviewBar, type ProposalScreen } from "./movement-proposal-parts";

const SCREENS: readonly ProposalScreen[] = [
  "board",
  "transport",
  "proposed-board",
  "proposed-movement",
  "proposed-transport",
];

/**
 * Preview-only frame. By default it shows the CURRENT Movements and Transport Hub screens, same
 * structure, inside the polish layer. The earlier redesigns stay reachable as "Proposed" ideas.
 */
export function MovementProposalPreview({ screen, id }: { screen?: string; id?: string }) {
  const requested = screen === "movement" ? "proposed-movement" : screen;
  const active = SCREENS.find((name) => name === requested) ?? "board";
  const movementId = id ?? "WF-001";
  const current =
    active === "proposed-movement"
      ? `/mockups/ward-flow/movements/${encodeURIComponent(movementId)}`
      : active === "transport" || active === "proposed-transport"
        ? "/mockups/ward-flow/transport/officer"
        : "/mockups/ward-flow/movements";
  return (
    <>
      <ProposalPreviewBar active={active} current={current} />
      {active === "board" ? (
        <div className={polish.polish} data-testid="movement-polish-board">
          <MovementsScreen />
        </div>
      ) : null}
      {active === "transport" ? (
        <div className={polish.polish} data-testid="movement-polish-transport">
          <OfficerScreen />
        </div>
      ) : null}
      {active === "proposed-board" ? <MovementsBoardProposal /> : null}
      {active === "proposed-movement" ? <MovementRecordProposal movementId={movementId} /> : null}
      {active === "proposed-transport" ? <TransportHubProposal /> : null}
    </>
  );
}
