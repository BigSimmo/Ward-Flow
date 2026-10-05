"use client";

import { TransportHubProposal } from "@/components/ward-management/officer/proposal/transport-hub-proposal";

import { MovementRecordProposal } from "./movement-record-proposal";
import { MovementsBoardProposal } from "./movements-board-proposal";
import { ProposalPreviewBar } from "./movement-proposal-parts";

/** Preview-only frame: picks the proposed screen from the query, with the switcher above it. */
export function MovementProposalPreview({ screen, id }: { screen?: string; id?: string }) {
  const active = screen === "movement" || screen === "transport" ? screen : "board";
  const movementId = id ?? "WF-001";
  const current =
    active === "movement"
      ? `/mockups/ward-flow/movements/${encodeURIComponent(movementId)}`
      : active === "transport"
        ? "/mockups/ward-flow/transport/officer"
        : "/mockups/ward-flow/movements";
  return (
    <>
      <ProposalPreviewBar active={active} current={current} />
      {active === "board" ? <MovementsBoardProposal /> : null}
      {active === "movement" ? <MovementRecordProposal movementId={movementId} /> : null}
      {active === "transport" ? <TransportHubProposal /> : null}
    </>
  );
}
