"use client";

import { type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button, Sheet } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "./ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "./ward-flow-provider";
import { SharedAccessContext } from "./shell/ward-shared-access-context";
import { sinceLastLookCount, useSinceLastLook } from "./coordinator/since-last-look-panel";
import { loadEarly } from "./load-early";
import { preloadWhenIdle } from "./preload-when-idle";
import type { ChangesSinceLastLook } from "./coordinator/since-last-look";
import styles from "./since-last-look-pill.module.css";

// Phone script budget (PR #1742): the sheet's lines draw only once the Updates sheet opens, so their
// code stays off the first load. It is fetched when the browser is idle and draws in the same render
// once there (`loadEarly`), so an opened sheet does not wait a frame for it.
const sheetBody = loadEarly(() =>
  import("./coordinator/since-last-look-sheet-body").then((m) => m.SinceLastLookSheetBody),
);
const SinceLastLookSheetBody = sheetBody.Card;
preloadWhenIdle(async () => sheetBody.start());

/**
 * Audit two #36 (O23): the one "since you looked" sheet, titled "Since HH:MM" wherever it opens
 * (Ward and ED pill, Ward chip, Home banner, Handover phone). The body is the shared review; a
 * screen may pass a note (the 15-minute window, "now marked seen"), its own lines `after` the
 * review (the Ward page's Since yesterday) and the sheet's body semantics.
 */
export function SinceLastLookSheet({
  open,
  onClose,
  changes,
  since,
  now,
  windowMinutes,
  note,
  after,
  bodyTabIndex,
  bodyLabel,
  resolveReturnFocusTarget,
}: {
  open: boolean;
  onClose: () => void;
  /** The review captured when the sheet opened; `undefined` while closed. */
  changes: ChangesSinceLastLook | undefined;
  /** The time the review runs from; it names the sheet. */
  since: Instant;
  now: Instant;
  /** The look-back window, shown as the sheet's note ("15-minute window"). */
  windowMinutes?: number;
  /** Any other note for the sheet's description, after the window. */
  note?: string;
  /** A screen's own lines under the review. */
  after?: ReactNode;
  bodyTabIndex?: number;
  bodyLabel?: string;
  resolveReturnFocusTarget?: () => HTMLElement | null;
}) {
  const notes = [windowMinutes ? `${windowMinutes}-minute window` : null, note ?? null].filter(Boolean);
  const description = notes.length ? notes.join(" · ") : undefined;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Since ${formatInstantWithDay(since, now)}`}
      description={description}
      bodyTabIndex={bodyTabIndex}
      bodyLabel={bodyLabel}
      resolveReturnFocusTarget={resolveReturnFocusTarget}
    >
      <SinceLastLookSheetBody changes={changes} />
      {after}
    </Sheet>
  );
}

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
      <SinceLastLookSheet
        open={open}
        onClose={() => setReview(null)}
        changes={open ? review : undefined}
        since={review?.since ?? changes.since}
        now={now}
        windowMinutes={15}
        resolveReturnFocusTarget={returnFocusTarget}
      />
    </span>
  );
}

/**
 * Page tops (Josh approved, 9 Nov 2026): the same review as `SinceLastLookPill`, for a page that shows
 * it as a hero chip ("Updates 1"). The page draws the chip from `count` and `open`, and renders
 * `sheet` once. The review resets when the scope, user, world or scenario changes, as the pill's does.
 */
export function useSinceLastLookReview(
  scopeKey: string,
  /** A screen's own lines under the review (the Ward page's Since yesterday, 26 Nov 2026 mock-up). */
  after?: ReactNode,
): {
  count: number;
  since: Instant;
  open: () => void;
  sheet: ReactNode;
} {
  // Opted out of the React Compiler, as the ward's top bar that calls it is (ward-screen-top-bar.tsx);
  // `world` keeps its own useMemo, so the review sees the same changes.
  "use no memo";
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
  const [opened, setOpened] = useState<{ boundary: string; review: ChangesSinceLastLook } | null>(null);
  const review = opened?.boundary === boundary ? opened.review : null;
  return {
    count: sinceLastLookCount(changes),
    since: changes.since,
    open: () => {
      // Capture before acknowledgement. Updates after this click remain unread.
      setOpened({ boundary, review: changes });
      markSeen();
    },
    sheet: (
      <SinceLastLookSheet
        open={review !== null}
        onClose={() => setOpened(null)}
        changes={review ?? undefined}
        since={review?.since ?? changes.since}
        now={now}
        windowMinutes={15}
        after={after}
      />
    ),
  };
}
