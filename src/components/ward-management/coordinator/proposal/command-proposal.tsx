"use client";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";

import styles from "./command-proposal.module.css";

/**
 * Command polish preview (5 October 2026, third pass). Josh's direction: keep the screen's
 * structure exactly as it is and polish what is already there. So this renders the live
 * `CoordinatorScreen` itself, with every region, graph, control and behaviour unchanged, and
 * applies the polish only through this wrapper's stylesheet. The live route is untouched.
 */
export function CommandProposal() {
  return (
    <div className={styles.polish} data-testid="command-proposal">
      <CoordinatorScreen />
    </div>
  );
}
