"use client";

import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button, Sheet } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "./ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "./ward-flow-provider";
import { SharedAccessContext } from "./shell/ward-shared-access-context";
import { SinceLastLookSheetBody, sinceLastLookCount, useSinceLastLook } from "./coordinator/since-last-look-panel";
import type { ChangesSinceLastLook } from "./coordinator/since-last-look";
import styles from "./since-last-look-pill.module.css";

/** Subscribe here so review/open state never rerenders the Ward/ED screen. */
/**
 * `pillClassName` styles the pill as its host's own pill (My ward's phone hero passes Home's hero pill).
 * `collapseWhenEmpty` lets an empty slot leave the flow at every width, not only on a phone (the ED
 * board's hero, redesign 31 Oct 2026, so On TV sits with the other actions).
 */
export function SinceLastLookPill({
  scopeKey,
  pillClassName,
  collapseWhenEmpty = false,
}: {
  scopeKey: string;
  pillClassName?: string;
  collapseWhenEmpty?: boolean;
}) {
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
  return (
    <ScopedReview
      key={boundary}
      scopeKey={scopeKey}
      changes={changes}
      markSeen={markSeen}
      now={now}
      pillClassName={pillClassName}
      collapseWhenEmpty={collapseWhenEmpty}
    />
  );
}

function ScopedReview({
  scopeKey,
  changes,
  markSeen,
  now,
  pillClassName,
  collapseWhenEmpty,
}: {
  scopeKey: string;
  changes: ChangesSinceLastLook;
  markSeen: () => void;
  now: Instant;
  pillClassName?: string;
  collapseWhenEmpty: boolean;
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
      className={styles.slot}
      data-testid={`since-last-look-${scopeKey}`}
      data-empty={empty ? "true" : undefined}
      data-collapse={collapseWhenEmpty ? "true" : undefined}
      tabIndex={-1}
    >
      {empty ? null : (
        <Button
          ref={trigger}
          variant="sec"
          size="sm"
          className={pillClassName ? `${styles.pill} ${pillClassName}` : styles.pill}
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
