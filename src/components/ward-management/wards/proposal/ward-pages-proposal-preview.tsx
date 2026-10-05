"use client";

import { AnswerProposal } from "./answer-proposal";
import { BoardProposal } from "./board-proposal";
import { HubProposal } from "./hub-proposal";
import { wardPagesHref, type WardPagesScreen } from "./ward-pages-proposal-parts";
import { WardProposal } from "./ward-proposal";
import { WardBoard as PolishedBoard } from "./polish/ward-board";
import { WardIndex as PolishedHub } from "./polish/ward-index";
import { WardScreen as PolishedWard } from "./polish/ward-screen";
import styles from "./ward-pages-proposal.module.css";

const SCREENS: { id: string; label: string }[] = [
  { id: "hub", label: "Ward Hub" },
  { id: "ward", label: "Ward" },
  { id: "answer", label: "Ward answer" },
  { id: "board", label: "Ward board" },
  { id: "proposed-hub", label: "Proposed: Ward Hub" },
  { id: "proposed-ward", label: "Proposed: Ward today" },
  { id: "proposed-answer", label: "Proposed: Bed requests" },
  { id: "proposed-board", label: "Proposed: Bed board" },
];

const DEFAULT_UNIT = "rph-adult-secure";

function href(screen: string, id?: string): string {
  if (screen.startsWith("proposed-")) return wardPagesHref(screen.slice("proposed-".length) as WardPagesScreen, id);
  const query = new URLSearchParams({ screen });
  if (id && screen !== "hub") query.set("id", id);
  return `/mockups/ward-flow/wards/proposal?${query.toString()}`;
}

/**
 * Preview-only frame. The first four screens are the current ward screens with their structure
 * kept and polish only (Josh, 5 October 2026: "You are simply polishing and elevating everything
 * that is already there"). The "Proposed" four are the earlier redesign, kept for reference only.
 */
export function WardPagesProposalPreview({ screen, id }: { screen?: string; id?: string }) {
  const active = SCREENS.find((entry) => entry.id === screen)?.id ?? "hub";
  return (
    <>
      <div className={styles.previewBar} data-testid="ward-pages-proposal-preview-bar">
        <strong>Ward pages, polished (preview)</strong>
        <nav aria-label="Ward pages preview">
          {SCREENS.map((entry) => (
            <a key={entry.id} href={href(entry.id, id)} aria-current={entry.id === active ? "page" : undefined}>
              {entry.label}
            </a>
          ))}
        </nav>
        <a className={styles.link} href="/mockups/ward-flow/wards">
          Current Ward Hub ›
        </a>
      </div>
      {active === "hub" ? <PolishedHub /> : null}
      {active === "ward" ? <PolishedWard unitId={id ?? DEFAULT_UNIT} /> : null}
      {active === "answer" ? <PolishedWard unitId={id ?? DEFAULT_UNIT} presentation="answer" /> : null}
      {active === "board" ? <PolishedBoard unitId={id ?? DEFAULT_UNIT} /> : null}
      {active === "proposed-hub" ? <HubProposal /> : null}
      {active === "proposed-ward" ? <WardProposal unitId={id} /> : null}
      {active === "proposed-answer" ? <AnswerProposal unitId={id} /> : null}
      {active === "proposed-board" ? <BoardProposal unitId={id} /> : null}
    </>
  );
}
