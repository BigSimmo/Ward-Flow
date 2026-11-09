"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { Button, Card, Sheet, StatusGlyph } from "@/components/wf";

import { sinceBannerText } from "./home-since-text";
import styles from "./home-pinned.module.css";
import type { ChangesSinceLastLook } from "./since-last-look";
import { SinceLastLookSheetBody, sinceLastLookCount, useSinceLastLook } from "./since-last-look-panel";

/**
 * Home's "What changed since my last shift" line (feature 40, 9 Nov 2026), first in Home's work
 * column. It reads Home's own explicit review (`useSinceLastLook` with `explicit`, the same stored
 * picture the Activity panel reviews), so leaving Home never marks anything seen. Review captures
 * the changes, then marks them seen; anything that arrives while the sheet is open stays new.
 * Before any review this session it counts from the start of the shift, and says so.
 * Hidden when nothing is new. Loaded lazily (`home-pins-lazy.tsx`), so it stays off Home's first load.
 */
export function HomeSinceBanner({ now }: { now: Instant }) {
  const { scenario, referrals, movements, units, bedReleases, admissions, worldGeneration } = useWardFlowSelect(
    "scenario",
    "referrals",
    "movements",
    "units",
    "bedReleases",
    "admissions",
    "worldGeneration",
  );
  const world = useMemo(
    () => ({ scenario, referrals, movements, units, bedReleases, admissions, worldGeneration }),
    [scenario, referrals, movements, units, bedReleases, admissions, worldGeneration],
  );
  const { changes, markSeen } = useSinceLastLook(world, now, { explicit: true });
  const [review, setReview] = useState<ChangesSinceLastLook | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const returnFocusTarget = useCallback(() => trigger.current ?? slot.current, []);
  const open = review !== null;
  // While the sheet is open the line keeps the captured words, so the button the sheet returns to stays put.
  const shown = open ? review : changes;
  const text =
    sinceLastLookCount(shown) > 0 ? sinceBannerText(shown, formatInstantWithDay(shown.since, now)) : undefined;

  return (
    // With nothing new the slot leaves the column's flow but stays focusable, so focus has a place
    // to land when a review empties it.
    <div
      ref={slot}
      tabIndex={-1}
      className={styles.bannerSlot}
      data-empty={text ? undefined : "true"}
      data-testid="home-since-banner-slot"
    >
      {text ? (
        <Card as="div" className={styles.banner} data-testid="home-since-banner">
          <StatusGlyph tone="info" size={10} className={styles.bannerGlyph} />
          <p className={styles.bannerText}>{text}</p>
          <Button
            ref={trigger}
            className={styles.bannerAction}
            variant="sec"
            size="sm"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              if (open) return;
              // Capture before acknowledgement, as the Ward pill does: updates after this press stay new.
              setReview(changes);
              markSeen();
            }}
            data-testid="home-since-review"
          >
            Review
          </Button>
        </Card>
      ) : null}
      <Sheet
        open={open}
        onClose={() => setReview(null)}
        title={review?.basis === "shift" ? "Since the shift started" : "Since you were last here"}
        description={`Changes since ${formatInstantWithDay(review?.since ?? changes.since, now)} · now marked seen`}
        resolveReturnFocusTarget={returnFocusTarget}
      >
        <SinceLastLookSheetBody changes={open ? review : undefined} />
      </Sheet>
    </div>
  );
}
