"use client";

// Copied from src/components/ward-management/since-last-look-pill.tsx (ED board redesign fork: an empty slot leaves
// the hero's flow at every width, not only on phone, so On TV sits with the other actions).

import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button, Sheet } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { SharedAccessContext } from "@/components/ward-management/shell/ward-shared-access-context";
import {
  SinceLastLookSheetBody,
  sinceLastLookCount,
  useSinceLastLook,
} from "@/components/ward-management/coordinator/since-last-look-panel";
import type { ChangesSinceLastLook } from "@/components/ward-management/coordinator/since-last-look";
import styles from "@/components/ward-management/since-last-look-pill.module.css";
import redesign from "./ed-board-redesign.module.css";

/** Subscribe here so review/open state never rerenders the Ward/ED screen. */
export function SinceLastLookPill({ scopeKey }: { scopeKey: string }) {
  const { scenario, referrals, movements, units, bedReleases, worldGeneration } = useWardFlowSelect(
    "scenario",
    "referrals",
    "movements",
    "units",
    "bedReleases",
    "worldGeneration",
  );
  const userId = useContext(SharedAccessContext)?.actorId ?? "local-demo";
  const now = useWardFlowClock();
  const world = useMemo(
    () => ({ scenario, referrals, movements, units, bedReleases, worldGeneration }),
    [scenario, referrals, movements, units, bedReleases, worldGeneration],
  );
  const { changes, markSeen } = useSinceLastLook(world, now, { scopeKey, windowMinutes: 15 });
  const boundary = `${scopeKey}:${userId}:${worldGeneration}:${scenario}`;
  return <ScopedReview key={boundary} scopeKey={scopeKey} changes={changes} markSeen={markSeen} now={now} />;
}

function ScopedReview({
  scopeKey,
  changes,
  markSeen,
  now,
}: {
  scopeKey: string;
  changes: ChangesSinceLastLook;
  markSeen: () => void;
  now: Instant;
}) {
  const [review, setReview] = useState<ChangesSinceLastLook | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const slot = useRef<HTMLSpanElement>(null);
  const count = sinceLastLookCount(changes);
  const open = review !== null;
  // Reviewing the last unread update empties the slot, so the button is gone when the sheet
  // closes. Focus then returns to the slot itself rather than falling to the page body.
  const returnFocusTarget = useCallback(() => trigger.current ?? slot.current, []);
  // Simplification A4 (Josh, 19 Oct 2026): "0 updates since 10:28" was the loudest thing in the
  // header and said nothing. With nothing new the slot keeps its place, so the header never jumps
  // when an update arrives, but shows no button until there is something to review.
  const empty = count === 0 && !open;
  return (
    <span
      ref={slot}
      className={empty ? `${styles.slot} ${redesign.slotEmpty}` : styles.slot}
      data-testid={`since-last-look-${scopeKey}`}
      data-empty={empty ? "true" : undefined}
      tabIndex={-1}
    >
      {empty ? null : (
        <Button
          ref={trigger}
          variant="sec"
          size="sm"
          className={styles.pill}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            if (open) {
              setReview(null);
              return;
            }
            // Capture before acknowledgement. Updates after this click remain unread.
            setReview(changes);
            markSeen();
          }}
        >
          {count} {count === 1 ? "update" : "updates"} since {formatInstantWithDay(changes.since, now)}
        </Button>
      )}
      <Sheet
        open={open}
        onClose={() => setReview(null)}
        title="Since you last looked"
        description={`Updates since ${formatInstantWithDay(review?.since ?? changes.since, now)} · 15-minute window`}
        resolveReturnFocusTarget={returnFocusTarget}
      >
        <SinceLastLookSheetBody changes={open ? review : undefined} />
      </Sheet>
    </span>
  );
}
