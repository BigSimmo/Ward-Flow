"use client";

// What Placement shows on desktop before anyone is chosen (approved Home mock-up v7, 22 Oct 2026):
// no patient is pre-selected, so nothing can be acted on until the coordinator picks one.

import { MousePointerClick } from "lucide-react";

import { Card, CardHead } from "@/components/wf";

import styles from "./home-list.module.css";

export function PlacementPrompt() {
  return (
    <Card className={styles.promptCard} data-testid="home-placement-prompt" aria-label="Placement">
      <CardHead title="Placement" />
      <div className={styles.promptBody}>
        <MousePointerClick size={20} aria-hidden="true" className={styles.promptIcon} />
        <p className={styles.promptText}>Choose a patient, alert or referral from the list.</p>
      </div>
    </Card>
  );
}
