"use client";

import { AnswerProposal } from "./answer-proposal";
import { BoardProposal } from "./board-proposal";
import { HubProposal } from "./hub-proposal";
import { wardPagesHref, type WardPagesScreen } from "./ward-pages-proposal-parts";
import { WardProposal } from "./ward-proposal";
import styles from "./ward-pages-proposal.module.css";

const SCREENS: { id: WardPagesScreen; label: string }[] = [
  { id: "hub", label: "Ward Hub" },
  { id: "ward", label: "Ward today" },
  { id: "answer", label: "Bed requests" },
  { id: "board", label: "Bed board" },
];

/** Preview-only frame: a banner and screen switcher around the proposed ward pages. */
export function WardPagesProposalPreview({ screen, id }: { screen?: string; id?: string }) {
  const active = SCREENS.find((entry) => entry.id === screen)?.id ?? "hub";
  return (
    <>
      <div className={styles.previewBar} data-testid="ward-pages-proposal-preview-bar">
        <strong>Proposed ward pages (preview)</strong>
        <nav aria-label="Proposed ward pages">
          {SCREENS.map((entry) => (
            <a
              key={entry.id}
              href={wardPagesHref(entry.id, id)}
              aria-current={entry.id === active ? "page" : undefined}
            >
              {entry.label}
            </a>
          ))}
        </nav>
        <a className={styles.link} href="/mockups/ward-flow/wards">
          Current Ward Hub ›
        </a>
      </div>
      {active === "hub" ? <HubProposal /> : null}
      {active === "ward" ? <WardProposal unitId={id} /> : null}
      {active === "answer" ? <AnswerProposal unitId={id} /> : null}
      {active === "board" ? <BoardProposal unitId={id} /> : null}
    </>
  );
}
