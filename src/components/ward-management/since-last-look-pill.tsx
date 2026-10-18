"use client";

import { useContext, useMemo, useRef, useState } from "react";
import { Button, Sheet } from "@/components/wf";
import { formatInstantWithDay } from "./ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "./ward-flow-provider";
import { SharedAccessContext } from "./shell/ward-shared-access-context";
import { SinceLastLookSheetBody, sinceLastLookCount, useSinceLastLook } from "./coordinator/since-last-look-panel";
import type { ChangesSinceLastLook } from "./coordinator/since-last-look";
import styles from "./since-last-look-pill.module.css";

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
  return <ScopedReview key={boundary} scopeKey={scopeKey} changes={changes} markSeen={markSeen} />;
}

function ScopedReview({
  scopeKey,
  changes,
  markSeen,
}: {
  scopeKey: string;
  changes: ChangesSinceLastLook;
  markSeen: () => void;
}) {
  const now = useWardFlowClock();
  const [review, setReview] = useState<ChangesSinceLastLook | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const count = sinceLastLookCount(changes);
  const open = review !== null;
  return (
    <span className={styles.slot} data-testid={`since-last-look-${scopeKey}`}>
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
      <Sheet
        open={open}
        onClose={() => setReview(null)}
        title="Since you last looked"
        description={`Updates since ${formatInstantWithDay(review?.since ?? changes.since, now)} · 15-minute window`}
        returnFocusRef={trigger}
      >
        <SinceLastLookSheetBody changes={open ? review : undefined} />
      </Sheet>
    </span>
  );
}
