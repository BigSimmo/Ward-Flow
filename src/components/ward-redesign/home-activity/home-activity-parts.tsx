"use client";

import { MousePointerClick } from "lucide-react";

import { Button, Card, CardHead } from "@/components/wf";
import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import styles from "./home-redesign.module.css";

/**
 * Placement before anyone is chosen: a copy of the Home redesign's `PlacementNext` with a shorter
 * prompt. Josh's Home v7 rule stands (22 Oct 2026): nothing is pre-selected, so Placement opens only
 * for the person the coordinator chooses; the box names the oldest alert to place, with one button.
 */
export function PlacementPrompt({
  next,
  onOpen,
}: {
  next: QueueEntry | undefined;
  onOpen: (entry: QueueEntry) => void;
}) {
  return (
    <Card data-testid="home-placement-prompt" aria-labelledby="home-placement-title">
      <CardHead id="home-placement-title" title="Placement" meta="opens for the person you choose" />
      <div className={styles.promptBody}>
        <MousePointerClick size={20} aria-hidden="true" className={styles.promptIcon} />
        <div className={styles.promptMain}>
          <p>Choose someone from the list to place them.</p>
          {next ? (
            <div className={styles.nextUp}>
              <span className={styles.kicker}>Oldest alert to place</span>
              <b>{next.subject.displayName}</b>
              <span className={styles.muted}>
                {next.item.title} · {next.subject.from}
              </span>
              <Button size="sm" variant="sec" onClick={() => onOpen(next)}>
                Open {next.subject.displayName}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
